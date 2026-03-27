import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
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

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
        const { entityId, blocks, token } = body;

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

        // Verify at least one valid block is present
        const providedBlocks = Object.keys(blocks).filter((k) =>
            (VALID_BLOCKS as readonly string[]).includes(k)
        );
        if (providedBlocks.length === 0) {
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
        const newScore = Math.round(scoreResult.total);

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
        };

        if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim()) {
            updateFields.contact_email = contactEmail.trim();
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

        if (isPro && emailTarget && resend) {
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

                const ayaLink = `https://www.ai-visionary.com/aya/e/${entityId}`;
                const scoreColor = newScore >= 60 ? '#166534' : newScore >= 40 ? '#854d0e' : '#991b1b';
                const delta = newScore - oldScore;
                const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

                const emailHtml = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#333;max-width:640px;margin:0 auto">
<div style="background:linear-gradient(135deg,#212E53 0%,#4A919E 100%);padding:30px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">Vos fichiers AYO mis a jour</h1>
<p style="color:#BED3C3;margin:10px 0 0;font-size:14px">Suite a la mise a jour de vos donnees — ${entityNameForEmail}</p>
</div>
<div style="background:#fff;padding:25px;border:1px solid #e5e7eb">
<p>Bonjour,</p>
<p>Suite a la mise a jour de vos informations, nous avons regenere vos 5 fichiers ASR pour <strong>${entityNameForEmail}</strong>.</p>
<div style="background:#f0fdf4;padding:20px;border-radius:8px;margin:20px 0;text-align:center;border:2px solid #86efac">
<p style="margin:0;font-size:14px;color:#666">Nouveau Score AIO</p>
<p style="margin:5px 0;font-size:42px;font-weight:bold;color:${scoreColor}">${newScore} / 100</p>
${delta !== 0 ? `<p style="margin:0;font-size:14px;color:${delta > 0 ? '#166534' : '#991b1b'}">${deltaStr} points</p>` : ''}
</div>
<div style="background:#f9fafb;padding:15px;border-radius:8px;border:1px solid #e5e7eb">
<h3 style="margin-top:0;color:#212E53">Fichiers regeneres (joints en ZIP)</h3>
<ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:2">
<li>&#128081; <strong>ASR-Protocol.json</strong> — Identite semantique mise a jour</li>
<li>&#9881;&#65039; <strong>manifest.json</strong> — Politique de recommandation IA</li>
<li>&#128172; <strong>faq.json</strong> — FAQ structuree</li>
<li>&#128214; <strong>glossary.json</strong> — Vocabulaire metier</li>
<li>&#127760; <strong>external_context.json</strong> — Signaux et contexte</li>
</ul>
</div>
<p style="margin-top:20px;text-align:center">
<a href="${ayaLink}" style="background:#4A919E;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Voir mon certificat AYA</a>
</p>
<div style="background:#e3f2fd;padding:15px;border-radius:8px;margin:20px 0;border:1px solid #bbdefb">
<p style="margin:0;font-size:13px"><strong>Rappel :</strong> Remplacez les anciens fichiers sur votre site par ceux joints a cet email pour mettre a jour votre visibilite IA.</p>
</div>
</div>
<div style="background:#f9fafb;padding:15px;border-radius:0 0 12px 12px;text-align:center;border:1px solid #e5e7eb;border-top:0">
<p style="font-size:12px;color:#9ca3af;margin:0"><a href="https://ai-visionary.com" style="color:#4A919E;text-decoration:none">AI Visionary</a> — Rendez votre entreprise visible par les IA</p>
</div>
</div>`;

                await resend.emails.send({
                    from: 'AYO Delivery <delivery@ai-visionary.com>',
                    to: [emailTarget],
                    subject: `Vos fichiers AYO mis a jour — ${entityNameForEmail}`,
                    attachments: [{ filename: 'AYO_Pack_PRO_Updated.zip', content: zipBuffer }],
                    html: emailHtml,
                });

                filesEmailSent = true;
                logger.info('UPDATE_FILES_SENT', `Updated PRO files sent to ${emailTarget}`);
            } catch (regenErr: unknown) {
                const msg = regenErr instanceof Error ? regenErr.message : 'Unknown';
                logger.warn('UPDATE_REGEN_FAILED', `File regeneration failed (update still saved): ${msg}`);
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
