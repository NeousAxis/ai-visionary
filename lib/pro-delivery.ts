// lib/pro-delivery.ts — Livraison GRATUITE du Pack PRO (sans Stripe).
//
// Réplique la livraison du webhook Stripe (registerOrUpdateEntity + generateProPack
// + zip + email) mais déclenchée par une vérification OTP au lieu d'un paiement.
// Le webhook Stripe reste INTOUCHÉ (ce module est 100% additif).
//
// registerOrUpdateEntity(..., 'purchase') pose owner_email = contact_email (l'email
// vérifié OTP devient l'unique admin) ET publie l'entité sur AYA (payment_completed).

import JSZip from 'jszip';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mailer';
import { sanitizeBusinessType, sanitizeExtract } from '@/lib/ayo-generators';
import { generateProPack, type ArchitecteInput } from '@/lib/agents/architecte';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { normalizeCountryCode } from '@/lib/aya/country-iso';

export interface FreeDeliveryInput {
  analysisData: {
    url: string;
    score: number;
    extract: Record<string, any>;
    blocks?: Record<string, number>;
  };
  email: string;
  locale: 'fr' | 'en';
  /** Name the owner confirmed at the legal-name prompt. Wins over the scanned page title. */
  confirmedName?: string;
  dryRun?: boolean; // test : génère les fichiers SANS écrire le registre ni emailer
}

/**
 * Business type (schema.org-like, from the scan) → the registry's sector labels, the same
 * labels the bot writes (aya/parser.py) and the registry card translates. The raw type
 * ("TechnologyCompany") is never a sector: it used to be printed as-is on the public card.
 */
const SECTOR_BY_BUSINESS_TYPE: Record<string, string> = {
  technologycompany: 'Technologie & SaaS',
  softwareapplication: 'Technologie & SaaS',
  webapplication: 'Technologie & SaaS',
  foodestablishment: 'Restauration & Alimentation',
  restaurant: 'Restauration & Alimentation',
  cafeorcoffeeshop: 'Restauration & Alimentation',
  bakery: 'Restauration & Alimentation',
  store: 'E-commerce & Retail',
  onlinestore: 'E-commerce & Retail',
  shoppingcenter: 'E-commerce & Retail',
  financialservice: 'Finance & Banque',
  bankorcreditunion: 'Finance & Banque',
  insuranceagency: 'Finance & Banque',
  medicalbusiness: 'Santé & Pharma',
  medicalorganization: 'Santé & Pharma',
  medicalclinic: 'Santé & Pharma',
  hospital: 'Santé & Pharma',
  pharmacy: 'Santé & Pharma',
  educationalorganization: 'Éducation & Formation',
  school: 'Éducation & Formation',
  collegeoruniversity: 'Éducation & Formation',
  consultingfirm: 'Conseil & Services Pro',
  professionalservice: 'Conseil & Services Pro',
  accountingservice: 'Conseil & Services Pro',
  legalservice: 'Conseil & Services Pro',
  marketingagency: 'Média & Communication',
  designagency: 'Média & Communication',
  newsmediaorganization: 'Média & Communication',
  hotel: 'Tourisme & Transport',
  travelagency: 'Tourisme & Transport',
  realestateagent: 'Immobilier',
  governmentorganization: 'Administration & Public',
  nonprofitorganization: 'ONG & Associations',
};

/**
 * business_type as one string. A JSON-LD @type can be an array (["LocalBusiness",
 * "TaxiService"]): `.toLowerCase()` on it threw and the free delivery failed with a 500.
 * Keeps the most specific entry (not the generic Organization / LocalBusiness).
 */
export function businessTypeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const types = value.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    return types.find(t => !/^(Organization|LocalBusiness|Thing)$/i.test(t.trim())) || types[0] || '';
  }
  return '';
}

export function sectorFromBusinessType(businessType: string): string {
  const key = (businessType || '').trim().toLowerCase().replace(/^https?:\/\/schema\.org\//, '');
  return SECTOR_BY_BUSINESS_TYPE[key] || 'General';
}

export interface FreeDeliveryResult {
  ayaId: string;
  emailSent: boolean;
  entityName: string;
  files?: Record<string, any>;
}

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.xyz';

export async function deliverProPackFree(
  input: FreeDeliveryInput,
): Promise<FreeDeliveryResult> {
  const logger = createLogger(generateCorrelationId(), 'free-delivery');
  const { analysisData, email, locale } = input;
  const ext = (analysisData.extract || {}) as Record<string, any>;

  // 1. Entity metadata. The owner-confirmed name replaces the scanned one EVERYWHERE
  //    (registry row + identite.name + identite.legal_name → the 5 files), otherwise the
  //    page title with its tagline ends up as the entity's public name.
  const confirmedName = (input.confirmedName || '').trim();
  if (confirmedName) {
    ext.identite = ext.identite || {};
    ext.identite.name = { value: confirmedName, q: 1, evidence: ['user_confirmed'] };
    ext.identite.legal_name = { value: confirmedName, q: 1, evidence: ['user_confirmed'] };
  }
  const entityName =
    confirmedName ||
    ext.identite?.name?.value ||
    ext.identite?.legal_name?.value ||
    (locale === 'fr' ? 'Entreprise' : 'Entity');

  const entityBusinessType = businessTypeString(ext.identite?.business_type?.value);
  const entityCountry = ext.identite?.country?.value || '';
  const lowerEBT = entityBusinessType.toLowerCase();
  const lowerEName = entityName.toLowerCase();
  const lowerEUrl = (analysisData.url || '').toLowerCase();
  const isAssociation =
    lowerEBT.includes('association') || lowerEBT.includes('ong') ||
    lowerEBT.includes('fondation') || lowerEBT.includes('non-profit') ||
    lowerEBT.includes('nonprofit') || lowerEName.startsWith('association ') ||
    lowerEName.includes('asso ') || lowerEUrl.includes('.org');
  const entityType = isAssociation ? ('association' as const) : ('company' as const);
  const countryLegal = normalizeCountryCode(entityCountry) ?? 'XX';
  const sectorMacro = sectorFromBusinessType(sanitizeBusinessType(entityBusinessType));

  // 2. Register / update + PUBLISH on AYA. 'purchase' sets owner_email = contact_email
  //    (the OTP-verified email becomes the sole admin) and makes the entity visible.
  let ayaId = 'dry-run';
  if (!input.dryRun) {
    const { registerOrUpdateEntity } = await import('@/lib/aya/registry');
    ayaId = await registerOrUpdateEntity(
      {
        legal_name: entityName,
        display_name: entityName,
        entity_type: entityType,
        country_legal: countryLegal,
        // Unknown type: let the registry keep an existing sector rather than write 'General' over it.
        sector_macro: sectorMacro !== 'General' ? sectorMacro : undefined,
        website: analysisData.url,
        asr_score: Math.round(analysisData.score || 0),
        contact_email: email, // → becomes owner_email (sole admin)
        asr_payload: { data: ext } as any,
      },
      'purchase',
    );
    logger.info('FREE_AYA_OK', `AYA published: ${ayaId} (${entityName})`, { ayaId });
  }

  // 3. Sanitize + generate the 5 PRO files
  if (ext) sanitizeExtract(ext);
  const asrId = `asr_${ayaId}`;
  const architecteInput: ArchitecteInput = {
    extractData: ext,
    url: analysisData.url,
    email,
    mode: 'PRO',
    score: analysisData.score,
    date: new Date().toISOString(),
    asrId,
    locale,
  };
  const result = await generateProPack(architecteInput);
  logger.info('FREE_ARCHITECTE', `delivered=${result.delivered}, attempts=${result.attempts}`);

  // DRY-RUN : renvoie les 5 fichiers générés SANS écrire le registre ni emailer.
  if (input.dryRun) {
    return {
      ayaId,
      emailSent: false,
      entityName,
      files: {
        asr: result.files.asr,
        manifest: result.files.manifest,
        faq: result.files.faq,
        glossary: result.files.glossary,
        externalContext: result.files.externalContext,
      },
    };
  }

  // 4. ZIP the 5 files
  const zip = new JSZip();
  zip.file('ASR-Protocol.json', JSON.stringify(result.files.asr, null, 2));
  zip.file('manifest.json', JSON.stringify(result.files.manifest, null, 2));
  zip.file('faq.json', JSON.stringify(result.files.faq, null, 2));
  zip.file('glossary.json', JSON.stringify(result.files.glossary, null, 2));
  zip.file('external_context.json', JSON.stringify(result.files.externalContext, null, 2));
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // 5. Email the files + management links
  const html = buildFreeEmail({ name: entityName, score: Math.round(analysisData.score || 0), ayaId, locale });
  const subject =
    locale === 'en'
      ? `📥 Your 5 AYO files — ${entityName}`
      : `📥 Vos 5 fichiers AYO — ${entityName}`;
  const emailResult = await sendEmail({
    from: 'AYO Delivery <security@ai-visionary.xyz>',
    to: [email],
    subject,
    attachments: [{ filename: 'AYO_Pack.zip', content: zipBuffer }],
    html,
  });
  logger.info('FREE_EMAIL', `sent=${emailResult.success} to ${email}`);

  return { ayaId, emailSent: !!emailResult.success, entityName };
}

function buildFreeEmail(p: {
  name: string;
  score: number;
  ayaId: string;
  locale: 'fr' | 'en';
}): string {
  const certUrl = `${BASE}/aya/e/${p.ayaId}`;
  const updateUrl = `${BASE}/update/${p.ayaId}`;
  if (p.locale === 'en') {
    return `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;color:#212E53;max-width:560px;margin:0 auto;padding:24px;">
<h2 style="color:#212E53;">Your AYO files are ready 🐝</h2>
<p>Hi, here are the 5 files that make <strong>${esc(p.name)}</strong> readable and citable by AI agents — <strong>free</strong>.</p>
<p style="font-size:15px;">AIO score: <strong>${p.score}/100</strong></p>
<p><strong>Attached (AYO_Pack.zip):</strong></p>
<ul style="line-height:1.8;">
<li>ASR-Protocol.json — your signed digital identity</li>
<li>manifest.json — structured summary</li>
<li>faq.json · glossary.json · external_context.json</li>
</ul>
<p>Drop them at the root of your site (e.g. <code>/.ayo/</code>) so AI agents can read them.</p>
<p style="margin-top:24px;">🔎 Your public AYA record: <a href="${certUrl}" style="color:#4A919E;">${certUrl}</a></p>
<p>✏️ Manage / update / transfer admin: <a href="${updateUrl}" style="color:#4A919E;">${updateUrl}</a><br>
<span style="color:#64748B;font-size:13px;">Only this email (the admin) can view or update your data, via a one-time code. You can transfer admin rights to a colleague from that page.</span></p>
<p style="color:#64748B;font-size:12px;margin-top:24px;">AI Visionary · Geneva · powered by AYA</p>
</body></html>`;
  }
  return `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;color:#212E53;max-width:560px;margin:0 auto;padding:24px;">
<h2 style="color:#212E53;">Vos fichiers AYO sont prêts 🐝</h2>
<p>Bonjour, voici les 5 fichiers qui rendent <strong>${esc(p.name)}</strong> lisible et citable par les agents IA — <strong>gratuitement</strong>.</p>
<p style="font-size:15px;">Score AIO : <strong>${p.score}/100</strong></p>
<p><strong>En pièce jointe (AYO_Pack.zip) :</strong></p>
<ul style="line-height:1.8;">
<li>ASR-Protocol.json — votre identité numérique signée</li>
<li>manifest.json — résumé structuré</li>
<li>faq.json · glossary.json · external_context.json</li>
</ul>
<p>Déposez-les à la racine de votre site (ex. <code>/.ayo/</code>) pour que les agents IA puissent les lire.</p>
<p style="margin-top:24px;">🔎 Votre fiche publique AYA : <a href="${certUrl}" style="color:#4A919E;">${certUrl}</a></p>
<p>✏️ Gérer / mettre à jour / transférer l'admin : <a href="${updateUrl}" style="color:#4A919E;">${updateUrl}</a><br>
<span style="color:#64748B;font-size:13px;">Seul cet email (l'admin) peut consulter ou modifier vos données, via un code à usage unique. Vous pouvez transférer les droits admin à un collaborateur depuis cette page.</span></p>
<p style="color:#64748B;font-size:12px;margin-top:24px;">AI Visionary · Genève · propulsé par AYA</p>
</body></html>`;
}

function esc(s: string): string {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
}
