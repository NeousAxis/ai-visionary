import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pollen Agents — where AI agents find verified businesses',
  description:
    'The open, sovereign place where AI agents discover and trust 367,000+ verified businesses worldwide. Powered by the AYA registry.',
};

export default function PollenAgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
