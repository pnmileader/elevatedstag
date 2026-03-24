import Link from 'next/link'

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: '#F8F6F1', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: '#2C2A26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#F8F6F1', fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>ES</span>
          </div>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#1A1814' }}>The Elevated Stag</span>
        </Link>

        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#1A1814', marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: '#A09A93', marginBottom: 32 }}>
          Effective: March 2026
        </p>

        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 15, lineHeight: 1.7, color: '#2C2A26' }}>

          <Section title="Overview">
            The Elevated Stag CRM is a private client management tool operated by Katie Fore / The Elevated Stag, based in Austin, Texas. This policy describes how we collect, use, and protect information within the application.
          </Section>

          <Section title="Information We Collect">
            The CRM stores information that is entered directly by the business owner, including:
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>Client names, email addresses, phone numbers, and mailing addresses</li>
              <li>Body measurements and fitting notes</li>
              <li>Order history, garment details, and fabric selections</li>
              <li>Client photos (fittings, owned items)</li>
              <li>Style preferences, personal notes, and appointment history</li>
            </ul>
          </Section>

          <Section title="How We Use Information">
            All information is used solely for managing client relationships, fulfilling custom clothing orders, and providing personalized service. We do not use client data for marketing to third parties, and we do not sell, rent, or share client information with anyone outside the business.
          </Section>

          <Section title="Third-Party Integrations">
            The application integrates with the following services, each authorized by the business owner:
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li><strong>Google (Calendar & Gmail)</strong> — Used to sync appointments and send emails to clients. Access is authorized via OAuth and can be revoked at any time.</li>
              <li><strong>QuickBooks Online</strong> — Used to sync invoices and financial records. Access is authorized via OAuth and can be revoked at any time.</li>
            </ul>
            These services have their own privacy policies. We only share the minimum data necessary for each integration to function.
          </Section>

          <Section title="Data Storage & Security">
            Data is stored securely using Supabase, a cloud database platform. All data is encrypted at rest and in transit (TLS). Access to the application is protected by email/password authentication with brute-force protection.
          </Section>

          <Section title="Cookies">
            The application uses only essential cookies for authentication (session management). We do not use cookies for tracking, analytics, or advertising.
          </Section>

          <Section title="Data Retention & Deletion">
            Client data is retained as long as the business relationship is active. If you would like to request deletion of your data, please contact us at{' '}
            <a href="mailto:katie@theelevatedstag.com" style={{ color: '#826D3C' }}>katie@theelevatedstag.com</a>.
          </Section>

          <Section title="Contact">
            For questions about this privacy policy, contact:<br />
            Katie Fore / The Elevated Stag<br />
            <a href="mailto:katie@theelevatedstag.com" style={{ color: '#826D3C' }}>katie@theelevatedstag.com</a>
          </Section>

        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #E5E0D8', fontSize: 13, color: '#A09A93' }}>
          <Link href="/terms" style={{ color: '#826D3C', textDecoration: 'none' }}>Terms of Service</Link>
          {' '}&middot;{' '}
          <Link href="/" style={{ color: '#826D3C', textDecoration: 'none' }}>Back to app</Link>
        </div>

      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#1A1814', marginBottom: 8 }}>{title}</h2>
      <div>{children}</div>
    </div>
  )
}
