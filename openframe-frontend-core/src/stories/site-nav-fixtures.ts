import type { NavLink, SiteNav } from '../types/navigation';

const link = (id: string, label: string, href: string, extra: Partial<NavLink> = {}): NavLink => ({
  id,
  label,
  href,
  ...extra,
});

const agents: NavLink[] = [
  link('mingo', 'Mingo', '/openframe#mingo', {
    icon: { name: 'mingo' },
    description: 'The AI admin. Reads every log, fixes what it finds.',
  }),
  link('fae', 'Fae', '/openframe#fae', {
    icon: { name: 'fae' },
    description: "The AI helper on every user's computer.",
  }),
];

const capabilities: NavLink[] = [
  link('remote-access', 'Remote access', '/openframe#remote-access', {
    iconName: 'terminal-monitor',
    builtOn: 'MeshCentral',
  }),
  link('software', 'Software and patching', '/openframe#software', {
    iconName: 'package-check',
    builtOn: 'Chocolatey · Homebrew · WinGet',
  }),
  link('inventory', 'Device inventory', '/openframe#inventory', { iconName: 'computer-mouse', builtOn: 'Osquery' }),
  link('security', 'Security rules', '/openframe#security', { iconName: 'shield-check', builtOn: 'Fleet MDM' }),
  link('tenants', 'Cloud tenants', '/openframe#cloud-tenants', {
    iconName: 'buildings',
    builtOn: 'OpenFrame Tenant Management',
  }),
  link('docs', 'Client docs and passwords', '/openframe#docs', { iconName: 'book-bookmark', builtOn: 'OpenFrame KM' }),
];

const platformLinks: NavLink[] = [
  link('overview', 'Platform overview', '/openframe', { iconName: 'tags' }),
  link('roadmap', 'Roadmap and releases', '/roadmap-and-releases', { iconName: 'package-check' }),
  link('github', 'Open source on GitHub', 'https://github.com/flamingo-stack', {
    iconName: 'shield-check',
    external: true,
  }),
  link('trust', 'Trust Center', '/trust-center', { iconName: 'mobile-phone-shield' }),
];

const audiences: NavLink[] = [
  link('msp', 'MSPs', '/case-studies?for=msp', {
    iconName: 'buildings',
    description: 'Run every client from one place',
  }),
  link('mssp', 'MSSPs', '/case-studies?for=mssp', {
    iconName: 'shield-check',
    description: 'Security operations for clients',
  }),
  link('all-stories', 'All {count} customer stories', '/case-studies', { count: 21 }),
];

const learn: NavLink[] = [
  link('kb', 'Knowledge base', '/knowledge-base', { iconName: 'book-bookmark', description: 'How-tos and answers' }),
  link('blog', 'Blog', '/blog', { iconName: 'tags', description: 'Field notes on running IT with AI' }),
  link('faqs', 'FAQs', '/faqs', { iconName: 'shield-check', description: 'Quick answers before you buy' }),
];

const company: NavLink[] = [
  link('about', 'About', '/about', { iconName: 'buildings' }),
  link('careers', 'Careers and life at Flamingo', '/careers', { iconName: 'tags' }),
  link('contact', 'Contact', '/contact', { iconName: 'mobile-phone-shield' }),
];

/** A marketing site: three mega menus, a plain link, a closing band. */
export const siteNav: SiteNav = {
  menus: [
    {
      id: 'product',
      label: 'Product',
      match: ['/openframe', '/roadmap-and-releases'],
      columns: [
        { id: 'ai', title: 'Meet the AI', links: agents },
        { id: 'capabilities', title: 'What you can do', links: capabilities },
      ],
      sideLinks: platformLinks,
    },
    {
      id: 'customers',
      label: 'Customers',
      match: ['/case-studies'],
      columns: [{ id: 'stories', title: 'Stories from teams like yours', links: audiences }],
      features: [
        {
          id: 'utah',
          href: '/case-studies/utah-tech-repair',
          study: {
            id: 1,
            title: 'Utah Tech Repair automates 50% of routine tasks without adding headcount',
            summary: null,
            featured_image: null,
            msp: { name: 'Utah Tech Repair' },
          },
        },
        {
          id: 'somo',
          href: '/case-studies/somo-technologies',
          study: {
            id: 2,
            title: 'Somo Technologies saves 15 hours a week with open-source automation',
            summary: null,
            featured_image: null,
            msp: { name: 'Somo Technologies' },
          },
        },
      ],
    },
    {
      id: 'resources',
      label: 'Resources',
      match: ['/knowledge-base', '/blog', '/faqs', '/about', '/careers', '/contact'],
      columns: [{ id: 'learn', title: 'Learn', links: learn }],
      sideLinks: company,
      sideTitle: 'Company',
      showSocial: true,
    },
    { id: 'pricing', label: 'Pricing', href: '/pricing' },
  ],
  footerColumns: [
    { id: 'product', title: 'Product', links: [...agents, ...capabilities] },
    { id: 'customers', title: 'Customers', links: audiences },
    { id: 'resources', title: 'Resources', links: learn },
    { id: 'company', title: 'Company', links: company },
    { id: 'trust', title: 'Trust', links: [link('trust', 'Trust Center', '/trust-center')] },
  ],
  signIn: link('sign-in', 'Sign in', '/sign-in'),
  primaryCta: { label: 'Start free trial', href: '/signup' },
  closingBand: {
    heading: 'AI handles IT. You run the business.',
    subheading: 'Free for 14 days. No card, no contract.',
    secondary: link('demo', 'Book a demo', '/schedule-a-call'),
  },
  legal: {
    company: 'Flamingo AI, Inc.',
    notes: ['Apache-licensed core', 'Data hosted in the US'],
    links: [link('privacy', 'Privacy policy', '/legal/privacy'), link('llms', 'llms.txt', '/llms.txt')],
  },
  brand: {
    name: 'Flamingo',
    tagline: 'The open-source, AI-native IT platform.',
    social: [
      link('github', 'GitHub', 'https://github.com/flamingo-stack', { iconName: 'github', external: true }),
      link('linkedin', 'LinkedIn', 'https://linkedin.com/company/flamingo.run', {
        iconName: 'linkedin',
        external: true,
      }),
    ],
  },
};

/** A simple public platform: one dropdown with live counters, two plain links. */
export const simpleNav: SiteNav = {
  menus: [
    { id: 'events', label: 'Events', href: '/events' },
    {
      id: 'community',
      label: 'Community',
      match: ['/members', '/messages'],
      columns: [
        {
          id: 'community',
          links: [
            link('members', 'Members', '/members', { iconName: 'buildings' }),
            link('messages', 'Messages', '/messages', { iconName: 'tags', badgeKey: 'messages' }),
            link('requests', 'Join requests', '/requests', { iconName: 'shield-check', badgeKey: 'requests' }),
          ],
        },
      ],
      showSocial: true,
    },
    { id: 'join', label: 'Join', href: '/join' },
  ],
  footerColumns: [
    {
      id: 'community',
      title: 'Community',
      links: [link('events', 'Events', '/events'), link('join', 'Join', '/join')],
    },
    { id: 'legal', title: 'Legal', links: [link('privacy', 'Privacy policy', '/legal/privacy')] },
  ],
  primaryCta: 'waitlist',
  legal: { company: 'Miami Cyber Gang', notes: [], links: [] },
  brand: {
    name: 'Miami Cyber Gang',
    tagline: 'IT and security meetups in Miami.',
    social: [link('linkedin', 'LinkedIn', 'https://linkedin.com', { iconName: 'linkedin', external: true })],
  },
};

/** An admin hub: no menus, no CTA. The header is the logo, a leading cell and the host's actions. */
export const adminNav: SiteNav = {
  menus: [],
  footerColumns: [],
  primaryCta: 'none',
  legal: { company: 'Flamingo AI, Inc.', notes: [], links: [] },
  brand: { name: 'Product Hub', tagline: '', social: [] },
};
