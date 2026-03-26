import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import type { Metadata } from 'next';
import UpdateFormClient from './UpdateFormClient';
import { BLOCK_DEFINITIONS } from '@/lib/update-form-config';
import { extractFormValues } from '@/lib/form-to-extract';

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

  if (!entity || !entity.payment_completed) {
    return notFound();
  }

  const name = entity.display_name || entity.legal_name || 'Entite';

  // Extract the raw AyoExtract.fields from asr_payload.data
  const rawPayloadData = entity.asr_payload?.data?.fields ?? entity.asr_payload?.data ?? undefined;

  // Build initial form values from the entity data
  const initialValues = extractFormValues(rawPayloadData as Record<string, unknown> | undefined);

  // Inject entity-level fallbacks for fields that may not be in asr_payload
  if (!initialValues.identite) initialValues.identite = {};
  if (!initialValues.identite.name) initialValues.identite.name = entity.display_name || '';
  if (!initialValues.identite.legal_name) initialValues.identite.legal_name = entity.legal_name || '';
  if (!initialValues.identite.contact_email) initialValues.identite.contact_email = entity.contact_email || '';
  if (!initialValues.identite.country) initialValues.identite.country = entity.country_legal || '';
  if (!initialValues.identite.business_type) initialValues.identite.business_type = entity.sector_macro || '';

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
            Mise a jour annuelle
          </p>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: '#212E53', marginBottom: '0.5rem', fontWeight: '800' }}>
            {name}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1rem', maxWidth: '550px', margin: '0 auto' }}>
            Completez vos 7 blocs AIO pour maximiser votre score de lisibilite IA et votre visibilite aupres des assistants intelligents.
          </p>
        </div>
      </section>

      {/* FORM */}
      <section style={{ paddingTop: '0', paddingBottom: '4rem' }}>
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
          <UpdateFormClient
            entityId={entity.entity_id}
            entityName={name}
            packType={(entity as any).pack_type || null}
            entityEmail={entity.contact_email || ''}
            currentScore={entity.asr_score ?? null}
            initialValues={initialValues}
            blockDefinitions={BLOCK_DEFINITIONS}
          />
        </div>
      </section>
    </main>
  );
}
