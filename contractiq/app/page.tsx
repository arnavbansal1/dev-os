import { FileText, MapPin, Gauge, MessagesSquare, ShieldCheck } from 'lucide-react'

/**
 * ContractIQ landing page — React Server Component.
 * Styled with the allNeurons design system (docs/design.md): Inter Display,
 * brand Blue #115ACB, greyscale-default surfaces, flat depth (no shadows),
 * 4px spacing grid. No JS event handlers — hover states come from globals.css.
 */
export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
      {/* Nav */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid var(--border-default)',
          background: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ShieldCheck size={22} color="var(--brand)" strokeWidth={2.2} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 0 }}>ContractIQ</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <a href="/login" className="btn-ghost">Sign In</a>
          <a href="/signup" className="btn-primary">Get Started Free</a>
        </nav>
      </header>

      {/* Hero */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 'var(--space-6)',
          padding: '96px 48px 64px',
          maxWidth: 820,
          margin: '0 auto',
        }}
      >
        <span className="badge badge-blue">NDA &amp; MSA review · built for SMBs and freelancers</span>
        <h1 style={{ fontSize: 48, fontWeight: 700, lineHeight: '56px', letterSpacing: 0, maxWidth: 720 }}>
          Understand any contract in minutes — not hours
        </h1>
        <p style={{ fontSize: 16, fontWeight: 500, lineHeight: '24px', color: 'var(--text-secondary)', maxWidth: 560 }}>
          Upload an NDA or MSA and ContractIQ extracts the terms that matter — each with a page
          reference, a confidence score, and the exact sentence it came from. Ask questions in plain
          English, answered strictly from your document.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <a href="/signup" className="btn-primary">Get Started Free</a>
          <a href="/login" className="btn-ghost">Sign In</a>
        </div>
        <p className="type-sm" style={{ color: 'var(--text-secondary)' }}>
          Review time: 90 minutes → under 15. Text-layer PDFs up to 20 pages.
        </p>
      </section>

      {/* Feature grid */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 'var(--space-6)',
          padding: '0 48px 64px',
          maxWidth: 1080,
          margin: '0 auto',
        }}
      >
        <Feature
          icon={<MapPin size={20} color="var(--brand)" />}
          title="Page-level attribution"
          body="Every extracted term tells you exactly which page it lives on. Click it to jump straight there in the built-in viewer."
        />
        <Feature
          icon={<Gauge size={20} color="var(--brand)" />}
          title="Confidence you can see"
          body="Each term carries a confidence score, colour-coded green, amber, or red — so you know precisely what to double-check."
        />
        <Feature
          icon={<MessagesSquare size={20} color="var(--brand)" />}
          title="Chat grounded in your document"
          body='Ask "Is there an auto-renewal clause?" and get an answer drawn only from your contract, with a page citation every time.'
        />
        <Feature
          icon={<FileText size={20} color="var(--brand)" />}
          title="Your terms, your schema"
          body="Add up to five custom terms before processing to capture the clauses specific to your business."
        />
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-default)',
          background: '#FFFFFF',
          padding: '24px 48px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span className="type-sm" style={{ color: 'var(--text-secondary)', maxWidth: 640 }}>
          ContractIQ is an AI-assisted review tool, not legal advice. Always verify critical terms
          with a qualified lawyer.
        </span>
        <span className="type-sm" style={{ color: 'var(--text-secondary)' }}>Powered by OpenAI GPT-4o</span>
      </footer>
    </main>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="feature-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-blue-50)',
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px' }}>{title}</h3>
      <p className="type-sm" style={{ color: 'var(--text-secondary)', lineHeight: '18px' }}>{body}</p>
    </div>
  )
}
