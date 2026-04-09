import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import JSZip from 'jszip';
import crypto from 'crypto';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { computeAioScore, type AyoExtract } from '@/lib/aio-score-engine';
import { verifyUpdateToken } from '@/lib/update-token';
import { formDataToAyoExtract } from '@/lib/form-to-extract';
import { sanitizeExtract } from '@/lib/ayo-generators';
import { generateProPack, type ArchitecteInput } from '@/lib/agents/architecte';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Block names matching the AyoExtract.fields keys
const VALID_BLOCKS = [
    'identite', 'offre', 'processus_methodes', 'engagements_conformite',
    'indicateurs', 'contenus_pedagogiques', 'structure_technique',
] as const;

/**
 * POST /api/update-entity
 *
 * Updates an existing AYA entity's data (certified clients only).
 * Accepts changed 7-block data, merges with existing AyoExtract,
 * recalculates AIO score, saves to Supabase.
 */
export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'update-entity', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'update-entity');

    try {
        const body = await req.json();
        const { entityId, blocks, token, adminAccount } = body;

        // Locale detection: from request body, NEXT_LOCALE cookie, or default 'en'
        const locale: 'fr' | 'en' =
            (body.locale === 'fr' ? 'fr' : null) ||
            (req.cookies.get('NEXT_LOCALE')?.value === 'fr' ? 'fr' : null) ||
            'en';
        const en = locale === 'en';

        // --- Validate entityId ---
        if (!entityId || typeof entityId !== 'string') {
            logger.warn('UPDATE_MISSING_ID', 'Missing entityId in request body');
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
        }

        // --- Verify auth token ---
        if (!token || !verifyUpdateToken(token, entityId)) {
            logger.warn('UPDATE_INVALID_TOKEN', `Invalid or expired token for entity ${entityId}`);
            return NextResponse.json({ error: 'Token invalide ou expire. Rechargez la page.' }, { status: 401 });
        }

        // --- Validate blocks object ---
        if (!blocks || typeof blocks !== 'object') {
            logger.warn('UPDATE_MISSING_BLOCKS', 'Missing blocks in request body');
            return NextResponse.json({ error: 'blocks requis (objet avec les 7 blocs AIO)' }, { status: 400 });
        }

        // Verify at least one valid block OR admin account fields are present
        const providedBlocks = Object.keys(blocks).filter((k) =>
            (VALID_BLOCKS as readonly string[]).includes(k)
        );
        const hasAdminData = adminAccount && typeof adminAccount === 'object' &&
            (adminAccount.admin_nom || adminAccount.admin_prenom || adminAccount.admin_email_pro);
        if (providedBlocks.length === 0 && !hasAdminData) {
            return NextResponse.json(
                { error: 'Aucune modification detectee. Modifiez au moins un champ avant d\'enregistrer.' },
                { status: 400 }
            );
        }

        logger.info('UPDATE_START', `Updating entity ${entityId}`, { blocksProvided: providedBlocks });

        // --- Fetch entity and verify certification ---
        const entity = await db.getAyaEntityById(entityId);
        if (!entity) {
            logger.warn('UPDATE_NOT_FOUND', `Entity not found: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable' }, { status: 404 });
        }

        if (!entity.payment_completed) {
            logger.warn('UPDATE_NOT_CERTIFIED', `Entity not certified: ${entityId}`);
            return NextResponse.json(
                { error: 'Seules les entites certifiees peuvent mettre a jour leurs donnees' },
                { status: 403 }
            );
        }

        // --- Build AyoExtract by merging form blocks into existing payload ---
        const existingPayload = entity.asr_payload || {};

        // Resolve the actual AyoExtract — three possible storage shapes:
        //  A) asr_payload = { version, fields, source, ... }         → full AyoExtract at root
        //  B) asr_payload = { data: { version, fields, source } }    → wrapped AyoExtract
        //  C) asr_payload = { data: { identite, offre, ... } }       → OLD flat format (no fields wrapper)
        //     In case C, data IS the fields object — wrap it into a proper AyoExtract.
        let existingExtract: Partial<AyoExtract>;

        if (existingPayload.version && existingPayload.fields) {
            // Shape A
            existingExtract = existingPayload as Partial<AyoExtract>;
        } else {
            const data = (existingPayload.data || existingPayload) as Record<string, unknown>;

            if (data.fields && typeof data.fields === 'object') {
                // Shape B — data already has a fields wrapper
                existingExtract = data as Partial<AyoExtract>;
            } else {
                // Shape C — flat blocks (identite, offre, ...) ARE the fields
                // Wrap them so formDataToAyoExtract can find extract.fields
                const scan = (existingPayload.scan || {}) as AyoExtract['source']['scan'];
                existingExtract = {
                    version: 'AYO-EXTRACT-3.0',
                    source: {
                        url: entity.website || '',
                        scan,
                    },
                    fields: data as unknown as AyoExtract['fields'],
                };
            }
        }

        const oldScore = entity.asr_score || 0;

        const extract = formDataToAyoExtract(blocks, existingExtract);

        // --- Recalculate AIO score ---
        const scoreResult = computeAioScore(extract);
        // Score protection: updating data should NEVER lower the score
        // The user is adding/correcting data, not removing it
        const newScore = Math.max(Math.round(scoreResult.total), oldScore);

        logger.info('UPDATE_SCORE', `Score recalculated: ${oldScore} -> ${newScore}`, {
            oldScore,
            newScore,
            delta: newScore - oldScore,
            blocks: scoreResult.blocks,
        });

        // --- Build updated asr_payload to store ---
        // Preserve original storage structure (wrap in .data if that's how it was stored)
        let updatedPayload: Record<string, unknown>;
        if (existingPayload.version && existingPayload.fields) {
            // Was stored flat — update in-place
            updatedPayload = {
                ...existingPayload,
                ...extract,
                score: newScore,
                blocks: scoreResult.blocks,
                last_client_update: new Date().toISOString(),
            };
        } else {
            // Was stored as { data: <extract>, ... }
            updatedPayload = {
                ...existingPayload,
                data: extract,
                score: newScore,
                blocks: scoreResult.blocks,
                last_client_update: new Date().toISOString(),
            };
        }

        // --- Calculate next review due date ---
        const nextReviewDue = new Date();
        nextReviewDue.setDate(nextReviewDue.getDate() + 365);

        // --- Extract top-level fields for Supabase columns ---
        const identite = extract.fields?.identite;
        const offre = extract.fields?.offre;

        const displayName =
            identite?.name?.value ||
            identite?.legal_name?.value ||
            entity.display_name;
        const legalName =
            identite?.legal_name?.value ||
            identite?.name?.value ||
            entity.legal_name;
        const country = identite?.country?.value || entity.country_legal;
        const contactEmail = identite?.contact_email?.value || entity.contact_email;
        const businessType = (identite?.business_type?.value as string) || '';
        const firstService = (offre?.services?.value as string[])?.[0] || '';
        const sector = businessType || firstService || entity.sector_macro;

        // --- Update Supabase ---
        const updateFields: Record<string, unknown> = {
            display_name: displayName,
            legal_name: legalName,
            sector_macro: sector,
            country_legal: typeof country === 'string' && country.length === 2
                ? country.toUpperCase()
                : entity.country_legal,
            asr_payload: updatedPayload,
            asr_score: newScore,
            last_update: new Date().toISOString(),
        };

        if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim()) {
            updateFields.contact_email = contactEmail.trim();
        }

        // SECURITY: owner_email can ONLY be changed via the dedicated delegation endpoint
        delete updateFields.owner_email;

        // Admin account fields (separate from AIO scoring)
        if (adminAccount && typeof adminAccount === 'object') {
            if (adminAccount.admin_nom) updateFields.admin_nom = String(adminAccount.admin_nom).trim();
            if (adminAccount.admin_prenom) updateFields.admin_prenom = String(adminAccount.admin_prenom).trim();
            if (adminAccount.admin_email_pro) updateFields.admin_email_pro = String(adminAccount.admin_email_pro).trim().toLowerCase();
        }

        const updated = await db.updateEntityData(entityId, updateFields);

        if (!updated) {
            logger.error('UPDATE_DB_FAIL', `Failed to update entity ${entityId} in Supabase`);
            return NextResponse.json(
                { error: 'Erreur lors de la mise a jour en base' },
                { status: 500 }
            );
        }

        logger.info('UPDATE_SUCCESS', `Entity ${entityId} updated successfully`, {
            displayName,
            oldScore,
            newScore,
            nextReviewDue: nextReviewDue.toISOString(),
        });

        // --- Auto-regenerate PRO files if client has Pack PRO ---
        const packType = (entity.pack_type || '').toLowerCase();
        const isPro = packType === 'pro' || packType === 'pack pro';
        const emailTarget = (contactEmail && typeof contactEmail === 'string' ? contactEmail : entity.contact_email) || '';
        let filesEmailSent = false;

        if (isPro && emailTarget && process.env.SMTP_USER) {
            try {
                const entityNameForEmail = (displayName as string) || 'Entreprise';
                const extractDataForGen = extract;

                const { cleanedFields } = sanitizeExtract(extractDataForGen as unknown as Record<string, unknown>);
                if (cleanedFields.length > 0) {
                    logger.info('UPDATE_SANITIZE', `Cleaned ${cleanedFields.length} fields before regen`);
                }

                const asrId = `asr_${entityId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
                const architecteInput: ArchitecteInput = {
                    extractData: extractDataForGen as unknown as Record<string, unknown>,
                    url: entity.website || '',
                    email: emailTarget,
                    mode: 'PRO',
                    score: newScore,
                    date: new Date().toISOString(),
                    asrId,
                };

                const architecteResult = await generateProPack(architecteInput);
                logger.info('UPDATE_REGEN', `Files generated: delivered=${architecteResult.delivered}`);

                // Build ZIP
                const zip = new JSZip();
                zip.file('ASR-Protocol.json', JSON.stringify(architecteResult.files.asr, null, 2));
                zip.file('manifest.json', JSON.stringify(architecteResult.files.manifest, null, 2));
                zip.file('faq.json', JSON.stringify(architecteResult.files.faq, null, 2));
                zip.file('glossary.json', JSON.stringify(architecteResult.files.glossary, null, 2));
                zip.file('external_context.json', JSON.stringify(architecteResult.files.externalContext, null, 2));
                const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

                const ayaLink = `https://ai-visionary.xyz/aya/e/${entityId}`;
                const scoreColor = newScore >= 60 ? '#166534' : newScore >= 40 ? '#854d0e' : '#991b1b';
                const delta = newScore - oldScore;
                const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

                const emailHtml = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
<div style="background:linear-gradient(135deg,#212E53 0%,#4A919E 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">${en ? 'Your AYO files have been updated' : 'Vos fichiers AYO mis a jour'}</h1>
<p style="color:#BED3C3;margin:10px 0 0;font-size:14px">${en ? 'Following your data update' : 'Suite a la mise a jour de vos donnees'} — ${entityNameForEmail}</p>
</div>
<div style="background:#fff;padding:25px;border:1px solid #e5e7eb">
<p>${en ? 'Hello,' : 'Bonjour,'}</p>
<p>${en ? `Following your information update, we have regenerated your 5 ASR files for <strong>${entityNameForEmail}</strong>.` : `Suite a la mise a jour de vos informations, nous avons regenere vos 5 fichiers ASR pour <strong>${entityNameForEmail}</strong>.`}</p>
<div style="background:#f0fdf4;padding:20px;border-radius:8px;margin:20px 0;text-align:center;border:2px solid #86efac">
<p style="margin:0;font-size:14px;color:#666">${en ? 'New AIO Score' : 'Nouveau Score AIO'}</p>
<p style="margin:5px 0;font-size:42px;font-weight:bold;color:${scoreColor}">${newScore} / 100</p>
${delta !== 0 ? `<p style="margin:0;font-size:14px;color:${delta > 0 ? '#166534' : '#991b1b'}">${deltaStr} points</p>` : ''}
</div>
<div style="background:#f9fafb;padding:15px;border-radius:8px;border:1px solid #e5e7eb">
<h3 style="margin-top:0;color:#212E53">${en ? 'Regenerated files (ZIP attached)' : 'Fichiers regeneres (joints en ZIP)'}</h3>
<ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:2">
<li>&#128081; <strong>ASR-Protocol.json</strong> — ${en ? 'Updated semantic identity' : 'Identite semantique mise a jour'}</li>
<li>&#9881;&#65039; <strong>manifest.json</strong> — ${en ? 'AI recommendation policy' : 'Politique de recommandation IA'}</li>
<li>&#128172; <strong>faq.json</strong> — ${en ? 'Structured FAQ' : 'FAQ structuree'}</li>
<li>&#128214; <strong>glossary.json</strong> — ${en ? 'Business vocabulary' : 'Vocabulaire metier'}</li>
<li>&#127760; <strong>external_context.json</strong> — ${en ? 'Signals and context' : 'Signaux et contexte'}</li>
</ul>
</div>
<p style="margin-top:20px;text-align:center">
<a href="${ayaLink}" style="background:#4A919E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${en ? 'View my AYA certificate' : 'Voir mon certificat AYA'}</a>
</p>
<div style="background:#e3f2fd;padding:15px;border-radius:8px;margin:20px 0;border:1px solid #bbdefb">
<p style="margin:0;font-size:13px"><strong>${en ? 'Reminder:' : 'Rappel :'}</strong> ${en ? 'Replace the old files on your website with the ones attached to this email to update your AI visibility.' : 'Remplacez les anciens fichiers sur votre site par ceux joints a cet email pour mettre a jour votre visibilite IA.'}</p>
</div>
</div>
<div style="background:#f9fafb;padding:15px;border-radius:0 0 12px 12px;text-align:center;border:1px solid #e5e7eb;border-top:0">
<p style="font-size:12px;color:#9ca3af;margin:0"><a href="https://ai-visionary.xyz" style="color:#4A919E;text-decoration:none">AI Visionary</a> — ${en ? 'Make your business visible to AI' : 'Rendez votre entreprise visible par les IA'}</p>
</div>
</div>`;

                await sendEmail({
                    from: 'AYO Delivery <security@ai-visionary.xyz>',
                    to: [emailTarget],
                    subject: en ? `Your AYO files have been updated — ${entityNameForEmail}` : `Vos fichiers AYO mis a jour — ${entityNameForEmail}`,
                    attachments: [{ filename: 'AYO_Pack_PRO_Updated.zip', content: zipBuffer }],
                    html: emailHtml,
                });

                filesEmailSent = true;
                logger.info('UPDATE_FILES_SENT', `Updated PRO files sent to ${emailTarget}`);
            } catch (regenErr: unknown) {
                const msg = regenErr instanceof Error ? regenErr.message : 'Unknown';
                logger.warn('UPDATE_REGEN_FAILED', `File regeneration failed (update still saved): ${msg}`);
            }
        } else if (!isPro && emailTarget && process.env.SMTP_USER) {
            // AYA subscription clients: send simple confirmation email (no files)
            try {
                const entityNameForEmail = (displayName as string) || 'Entreprise';
                const ayaLink = `https://ai-visionary.xyz/aya/e/${entityId}`;
                const delta = newScore - oldScore;
                const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
                const scoreColor = newScore >= 60 ? '#166534' : newScore >= 40 ? '#854d0e' : '#991b1b';

                const confirmationHtml = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
<div style="background:linear-gradient(135deg,#212E53 0%,#4A919E 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">${en ? 'Update confirmed' : 'Mise a jour confirmee'}</h1>
<p style="color:#BED3C3;margin:10px 0 0;font-size:14px">${entityNameForEmail} — ${en ? 'AYA Registry' : 'Registre AYA'}</p>
</div>
<div style="background:#fff;padding:25px;border:1px solid #e5e7eb">
<p>${en ? 'Hello,' : 'Bonjour,'}</p>
<p>${en ? `Your data in the AYA registry has been successfully updated for <strong>${entityNameForEmail}</strong>.` : `Vos donnees dans le registre AYA ont ete mises a jour avec succes pour <strong>${entityNameForEmail}</strong>.`}</p>
<div style="background:#f0fdf4;padding:20px;border-radius:8px;margin:20px 0;text-align:center;border:2px solid #86efac">
<p style="margin:0;font-size:14px;color:#666">${en ? 'New AIO Score' : 'Nouveau Score AIO'}</p>
<p style="margin:5px 0;font-size:42px;font-weight:bold;color:${scoreColor}">${newScore} / 100</p>
${delta !== 0 ? `<p style="margin:0;font-size:14px;color:${delta > 0 ? '#166534' : '#991b1b'}">${deltaStr} points</p>` : ''}
</div>
<p>${en ? 'Your entry in the registry has been updated and is visible to AI assistants.' : 'Votre fiche dans le registre a ete mise a jour et est visible par les assistants IA.'}</p>
<p style="margin-top:20px;text-align:center">
<a href="${ayaLink}" style="background:#4A919E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${en ? 'View my AYA certificate' : 'Voir mon certificat AYA'}</a>
</p>
<div style="background:#fef9e7;padding:15px;border-radius:8px;margin:20px 0;border:1px solid #fde68a">
<p style="margin:0;font-size:13px">&#128161; <strong>${en ? 'Tip:' : 'Conseil :'}</strong> ${en ? 'To further improve your score, upgrade to Pack PRO (499 CHF) to get your 5 ASR files to install on your website.' : 'Pour ameliorer encore votre score, passez au Pack PRO (499 CHF) pour obtenir vos 5 fichiers ASR a installer sur votre site.'}</p>
</div>
</div>
<div style="background:#f9fafb;padding:15px;border-radius:0 0 12px 12px;text-align:center;border:1px solid #e5e7eb;border-top:0">
<p style="font-size:12px;color:#9ca3af;margin:0"><a href="https://ai-visionary.xyz" style="color:#4A919E;text-decoration:none">AI Visionary</a> — ${en ? 'Make your business visible to AI' : 'Rendez votre entreprise visible par les IA'}</p>
</div>
</div>`;

                await sendEmail({
                    from: 'AYO Delivery <security@ai-visionary.xyz>',
                    to: [emailTarget],
                    subject: en ? `Update confirmed — ${entityNameForEmail}` : `Mise a jour confirmee — ${entityNameForEmail}`,
                    html: confirmationHtml,
                });

                filesEmailSent = true;
                logger.info('UPDATE_CONFIRM_SENT', `Confirmation email sent to ${emailTarget} (AYA sub)`);
            } catch (emailErr: unknown) {
                const msg = emailErr instanceof Error ? emailErr.message : 'Unknown';
                logger.warn('UPDATE_CONFIRM_FAILED', `Confirmation email failed (update still saved): ${msg}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Donnees mises a jour avec succes',
            filesEmailSent,
            oldScore,
            newScore,
            nextReviewDue: nextReviewDue.toISOString(),
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('UPDATE_ERROR', message);
        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la mise a jour' },
            { status: 500 }
        );
    }
}
