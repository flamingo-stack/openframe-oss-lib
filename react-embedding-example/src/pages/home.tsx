import { Link } from 'react-router-dom'

const SURFACES = [
  { to: '/knowledge-base', title: 'Knowledge Hub', desc: 'DocsHubPage (sidebar tree + content + scroll-spy + in-source RAG search) over /content/api/docs/*.' },
  { to: '/onboarding-guides', title: 'Onboarding guides', desc: 'Catalog + detail, props-driven from /content/api/onboarding-guides.' },
  { to: '/roadmap', title: 'Roadmap', desc: 'Voting grid; votes + refresh hit /content/api/roadmap.' },
  { to: '/delivery', title: 'Delivery', desc: 'Bug-fix + enhancement tables; /content/api/delivery/*.' },
  { to: '/releases', title: 'Product releases', desc: 'List via the shared ProductReleasesView; detail injects a roadmap section.' },
  { to: '/authors', title: 'Authors', desc: 'Author byline (description card) + author-scoped related-content rail via /content/api/related-content?authorId=…' },
  { to: '/legal/privacy', title: 'Legal', desc: 'Privacy / terms via /content/api/legal/*.' },
  { to: '/contact', title: 'Contact', desc: 'ContactForm → /content/api/contact (EndpointsRuntime).' },
  { to: '/case-studies', title: 'Case studies — Share Your Experience', desc: 'Lib ShareExperienceSection (G2/Capterra/TrustPilot/GetApp benefit grid + proxied ContactForm).' },
  { to: '/tickets', title: 'Help center / tickets', desc: 'HelpCenterList (tickets hooks).' },
]

export function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-ods-text-primary">OpenFrame embedding example</h1>
      <p className="mt-2 max-w-3xl text-sm text-ods-text-secondary">
        Every surface below is the real <code>@flamingo-stack/openframe-frontend-core</code>{' '}
        component, talking to the hub through a <code>/content</code> reverse proxy that injects the
        chat secret + a fixed identity (Michael Assraf). Open the floating <strong>Ask AI</strong>{' '}
        chat — it greets Michael, resolved entirely server-side.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="rounded-lg border border-ods-border bg-ods-card p-4 transition-colors hover:border-ods-text-secondary"
          >
            <div className="font-medium text-ods-text-primary">{s.title}</div>
            <div className="mt-1 text-sm text-ods-text-secondary">{s.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
