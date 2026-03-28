import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import type { Metadata } from 'next';
import UpdateFormClient from './UpdateFormClient';
import OtpGate from './OtpGate';
import { BLOCK_DEFINITIONS } from '@/lib/update-form-config';
import { extractFormValues } from '@/lib/form-to-extract';
import { generateUpdateToken } from '@/lib/update-token';
import { getTranslations } from 'next-intl/server';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ entityId: string }> }): Promise<Metadata> {
  const { entityId } = await params;
  const entity = await db.getAyaEntityById(entityId);

  if (!entity || !entity.payment_completed) {
    return { title: 'Mise a jour — Non disponible' };
  }

  const name = entity.display_name || entity.legal_name || 'Entite';
  return {
    title: `Mettre a jour — ${name} | AYA`,
    description: `Mettez a jour les donnees de ${name} dans le registre AYA.`,
  };
}

export default async function UpdatePage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  const entity = await db.getAyaEntityById(entityId);
  const t = await getTranslations('update');

  if (!entity || !entity.payment_completed) {
    return notFound();
  }

  const name = entity.display_name || entity.legal_name || 'Entite';

  // SECURITY: Only owner_email (Stripe payer) can authenticate for updates
  const authEmail = entity.owner_email || '';

  // Extract the raw AyoExtract.fields from asr_payload.data
  const rawPayloadData = entity.asr_payload?.data?.fields ?? entity.asr_payload?.data ?? undefined;

  // Bug 11 fix: use extractFormValues with entity overrides (single source of truth)
  const initialValues = extractFormValues(
    rawPayloadData as Record<string, unknown> | undefined,
    {
      display_name: entity.display_name || undefined,
      legal_name: entity.legal_name || undefined,
      contact_email: entity.contact_email || undefined,
      country_legal: entity.country_legal || undefined,
      sector_macro: entity.sector_macro || undefined,
    }
  );

  // Pre-fill document URLs: check asr_payload for stored URLs, or derive from website
  const website = entity.website || '';
  const baseUrl = website.replace(/\/+$/, '');
  const pedagBlock = initialValues.contenus_pedagogiques || {};
  if (!pedagBlock.faq_url && pedagBlock.has_faq) {
    pedagBlock.faq_url = `${baseUrl}/.ayo/faq.json`;
  }
  if (!pedagBlock.glossary_url && pedagBlock.has_glossary) {
    pedagBlock.glossary_url = `${baseUrl}/.ayo/glossary.json`;
  }
  if (!pedagBlock.documentation_url && pedagBlock.has_documentation) {
    pedagBlock.documentation_url = `${baseUrl}/.ayo/docs.json`;
  }
  initialValues.contenus_pedagogiques = pedagBlock;

  // Bug 9 fix: derive pack_type from available data
  const packType = (entity as any).pack_type
    || ((entity as any).stripe_product_id?.includes('PRO') ? 'PRO'
      : entity.payment_completed ? 'AYA_SUB'
      : null);

  // Generate signed token for auth (Bug 2&3)
  const updateToken = generateUpdateToken(entity.entity_id);

  return (
    <main style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* NAV */}
      <div className="container" style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{ background: '#212E53', color: 'white', padding: '5px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>AV</div>
          <span style={{ fontWeight: 'bold', color: '#212E53', letterSpacing: '-0.02em' }}>AI VISIONARY</span>
        </Link>
        <BackButton />
      </div>

      {/* HERO */}
      <section style={{ paddingTop: '2rem', paddingBottom: '1.5rem', textAlign: 'center' }}>
        <div className="container">
          <p style={{ color: '#4A919E', fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            {t('pageLabel')}
          </p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: '#212E53', marginBottom: '0.5rem', fontWeight: '800' }}>
            {name}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem', maxWidth: '550px', margin: '0 auto' }}>
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* OTP AUTH + FORM */}
      <section style={{ paddingTop: '0', paddingBottom: '4rem' }}>
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
          <OtpGate
            entityId={entity.entity_id}
            entityEmail={authEmail}
            entityName={name}
            entityWebsite={entity.website || ''}
          >
            <UpdateFormClient
              entityId={entity.entity_id}
              entityName={name}
              packType={packType}
              entityEmail={entity.contact_email || ''}
              entityWebsite={entity.website || ''}
              ownerEmailMasked={authEmail ? authEmail.replace(/^(.{2})[^@]*/, '$1***') : ''}
              currentScore={entity.asr_score ?? null}
              initialValues={initialValues}
              blockDefinitions={BLOCK_DEFINITIONS}
              updateToken={updateToken}
              adminAccount={{
                nom: entity.admin_nom || '',
                prenom: entity.admin_prenom || '',
                email_pro: entity.admin_email_pro || '',
              }}
            />
          </OtpGate>
        </div>
      </section>
    </main>
  );
}
