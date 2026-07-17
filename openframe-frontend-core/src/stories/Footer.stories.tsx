import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Footer } from '../components/footer';
import { FlamingoLogo } from '../components/icons';

const meta = {
  title: 'Navigation/Footer',
  component: Footer,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '400px', background: 'var(--ods-system-greys-background, #161616)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

const logo = <FlamingoLogo fill="var(--ods-flamingo-pink-base)" className="flex-shrink-0 w-8 h-8" />;

const social = {
  github: '#',
  twitter: '#',
  reddit: '#',
};

const baseConfig = {
  name: 'Flamingo',
  legalName: 'Flamingo AI, Inc.',
  description:
    'AI-driven open-source OS for MSPs. Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back.',
  logo,
  social,
};

/** Dummy links — Storybook only exercises layout, so nothing needs to navigate. */
const link = (label: string) => ({ href: '#', label });

const productsSection = {
  title: 'PRODUCTS',
  links: ['OpenFrame', 'Customers', 'Partners', 'Releases', 'Knowledge Hub'].map(link),
};

const companySection = {
  title: 'COMPANY',
  links: ['Flamingo', 'About', 'Blog', 'Webinars', 'Media'].map(link),
};

const communitySection = {
  title: 'COMMUNITY',
  links: ['OpenMSP', 'Community', 'OpenMSP Podcast'].map(link),
};

const supportSection = {
  title: 'SUPPORT',
  links: ['Contact Us', 'Privacy Policy', 'Terms of Service'].map(link),
};

const PromoCard = () => (
  <div className="bg-ods-bg border border-ods-border rounded-lg p-6 w-full">
    <p className="font-body font-bold text-ods-text-primary">Ready to Break Free?</p>
    <p className="font-body text-sm text-ods-text-secondary pt-2">
      Stop paying vendor taxes. Start using open-source tools.
    </p>
  </div>
);

/**
 * Four link sections + the brand column — the widest supported layout.
 *
 * The brand column sits OUTSIDE the sections grid, so this renders as 5 equal
 * columns on desktop (brand `flex-1` + grid `flex-[4]`/`lg:grid-cols-4`).
 * Resize the viewport: tablet splits 50/50 (brand beside a 2x2 of the sections),
 * mobile stacks the brand on top with a 2x2 below.
 */
export const FourSections: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection, communitySection, supportSection],
    },
  },
};

/**
 * Three link sections — brand + 3 columns.
 */
export const ThreeSections: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection, supportSection],
    },
  },
};

/**
 * Two link sections — the leanest layout.
 */
export const TwoSections: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection],
    },
  },
};

/**
 * Social row hidden via `hideSocialRow`.
 */
export const WithoutSocialRow: Story = {
  args: {
    config: {
      ...baseConfig,
      hideSocialRow: true,
      sections: [productsSection, companySection, communitySection, supportSection],
    },
  },
};

/**
 * A `customComponent` (e.g. a CTA card) rendered as a cell in the sections grid.
 */
export const WithCustomComponent: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection],
      customComponent: <PromoCard />,
    },
  },
};

/**
 * Arbitrary `rightColumnContent` rendered after the sections.
 */
export const WithRightColumn: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection],
      rightColumnContent: <PromoCard />,
    },
  },
};

/**
 * `moveDescriptionToRight` — the brand column keeps only the logo/name while the
 * description moves into the right column.
 */
export const DescriptionMovedToRight: Story = {
  args: {
    config: {
      ...baseConfig,
      sections: [productsSection, companySection],
      moveDescriptionToRight: true,
      rightColumnContent: <PromoCard />,
    },
  },
};

/**
 * Custom `nameElement` and a `backgroundColor` override.
 */
export const CustomNameAndBackground: Story = {
  args: {
    config: {
      ...baseConfig,
      backgroundColor: 'bg-ods-card',
      nameElement: (
        <span className="font-mono text-heading-4 font-bold text-ods-text-primary">Flamingo</span>
      ),
      sections: [productsSection, companySection, communitySection, supportSection],
    },
  },
};
