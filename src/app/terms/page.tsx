import Link from 'next/link'

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: '#A09A93', marginBottom: 32 }}>
          Effective: March 2026
        </p>

        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 15, lineHeight: 1.7, color: '#2C2A26' }}>

          <Section title="About This Application">
            The Elevated Stag CRM is an internal business tool provided by Katie Fore / The Elevated Stag, based in Austin, Texas. It is designed for private use in managing client relationships for a custom clothing business. This application is not intended for public use.
          </Section>

          <Section title="Use of Service">
            Access to this application is restricted to authorized users of The Elevated Stag. The application is provided for internal business operations, including client management, order tracking, appointment scheduling, and communication.
          </Section>

          <Section title="Disclaimer of Warranties">
            This application is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. The Elevated Stag does not warrant that the service will be uninterrupted, error-free, or free of harmful components.
          </Section>

          <Section title="Limitation of Liability">
            To the fullest extent permitted by law, The Elevated Stag and its owner shall not be liable for any indirect, incidental, special, or consequential damages, including loss of data, revenue, or business opportunities, arising from the use of this application.
          </Section>

          <Section title="Data Responsibility">
            The business owner is responsible for the accuracy and appropriate use of all client data entered into the system. Data backup and retention practices are managed through the application&apos;s infrastructure providers (Supabase, Vercel).
          </Section>

          <Section title="Changes to Terms">
            These terms may be updated at any time without prior notice. Continued use of the application constitutes acceptance of the updated terms.
          </Section>

          <Section title="Contact">
            For questions about these terms, contact:<br />
            Katie Fore / The Elevated Stag<br />
            <a href="mailto:katie@theelevatedstag.com" style={{ color: '#826D3C' }}>katie@theelevatedstag.com</a>
          </Section>

        </div>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #E5E0D8', fontSize: 13, color: '#A09A93' }}>
          <Link href="/privacy" style={{ color: '#826D3C', textDecoration: 'none' }}>Privacy Policy</Link>
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
