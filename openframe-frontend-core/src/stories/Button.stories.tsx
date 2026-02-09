import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, ChevronRight, Download, Heart, Menu, MessageSquare, Plus, Search, Settings, ShoppingCart, Trash2, X } from 'lucide-react';
import { Button } from '../components/ui/button';

const meta = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'white',
        'secondary',
        'outline',
        'transparent',
        'ghost',
        'ghost-nav',
        'link',
        'search',
        'submit',
        'destructive',
        'success',
        'warning',
        'info',
        'flamingo-primary',
        'flamingo-secondary',
        'footer-link',
        'filter',
        'filter-active',
        'section',
        'section-active',
        'table-display',
        'device-action',
        'card',
      ],
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'icon', 'iconLg', 'touch', 'searchMobile', 'searchDesktop', 'none', 'section', 'sectionWrap'],
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidthOnMobile: { control: 'boolean' },
    alignment: {
      control: 'select',
      options: ['left', 'center', 'right'],
    },
    noPadding: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Primary button - main CTA style.
 */
export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

/**
 * Secondary button - alternative actions.
 */
export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

/**
 * White button - light background variant.
 */
export const White: Story = {
  args: {
    children: 'White Button',
    variant: 'white',
  },
};

/**
 * Outline button - bordered transparent style.
 */
export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
};

/**
 * Ghost button - minimal hover effect.
 */
export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

/**
 * Ghost navigation - left-aligned for nav menus.
 */
export const GhostNav: Story = {
  args: {
    children: 'Navigation Item',
    variant: 'ghost-nav',
  },
};

/**
 * Transparent button - ghost-like actions.
 */
export const Transparent: Story = {
  args: {
    children: 'Transparent',
    variant: 'transparent',
  },
};

/**
 * Link button - text-like appearance.
 */
export const Link: Story = {
  args: {
    children: 'Link Button',
    variant: 'link',
  },
};

/**
 * Destructive button - for dangerous actions.
 */
export const Destructive: Story = {
  args: {
    children: 'Delete',
    variant: 'destructive',
    leftIcon: <Trash2 />,
  },
};

/**
 * Success button - for positive actions.
 */
export const Success: Story = {
  args: {
    children: 'Success',
    variant: 'success',
  },
};

/**
 * Warning button - for cautionary actions.
 */
export const Warning: Story = {
  args: {
    children: 'Warning',
    variant: 'warning',
  },
};

/**
 * Info button - for informational actions.
 */
export const Info: Story = {
  args: {
    children: 'Info',
    variant: 'info',
  },
};

/**
 * Search button variant.
 */
export const SearchButton: Story = {
  args: {
    children: 'Search',
    variant: 'search',
    leftIcon: <Search />,
    size: 'searchDesktop',
  },
};

/**
 * Submit button - for form submissions.
 */
export const Submit: Story = {
  args: {
    children: 'Submit Product',
    variant: 'submit',
  },
};

/**
 * Flamingo primary - pink themed.
 */
export const FlamingoPrimary: Story = {
  args: {
    children: 'Flamingo Primary',
    variant: 'flamingo-primary',
  },
};

/**
 * Flamingo secondary - dark themed.
 */
export const FlamingoSecondary: Story = {
  args: {
    children: 'Flamingo Secondary',
    variant: 'flamingo-secondary',
  },
};

/**
 * Filter button - for sidebar filters.
 */
export const Filter: Story = {
  args: {
    children: 'Category',
    variant: 'filter',
  },
};

/**
 * Active filter button.
 */
export const FilterActive: Story = {
  args: {
    children: 'Category',
    variant: 'filter-active',
  },
};

/**
 * Section selector button.
 */
export const Section: Story = {
  args: {
    children: 'Feature Section',
    variant: 'section',
    size: 'section',
  },
};

/**
 * Active section selector.
 */
export const SectionActive: Story = {
  args: {
    children: 'Feature Section',
    variant: 'section-active',
    size: 'section',
  },
};

/**
 * Device action button.
 */
export const DeviceAction: Story = {
  args: {
    children: 'Run Script',
    variant: 'device-action',
  },
};

/**
 * Card button variant.
 */
export const Card: Story = {
  args: {
    children: 'Card Action',
    variant: 'card',
  },
};

// === Size Variants ===

/**
 * Small size button.
 */
export const SizeSmall: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

/**
 * Default size button.
 */
export const SizeDefault: Story = {
  args: {
    children: 'Default Button',
    size: 'default',
  },
};

/**
 * Large size button.
 */
export const SizeLarge: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

/**
 * Touch-friendly size.
 */
export const SizeTouch: Story = {
  args: {
    children: 'Touch Button',
    size: 'touch',
  },
};

// === Icon Buttons ===

/**
 * Icon-only button.
 */
export const IconOnly: Story = {
  args: {
    centerIcon: <Settings />,
    size: 'icon',
    variant: 'outline',
  },
};

/**
 * Large icon button (e.g., hamburger menu).
 */
export const IconLarge: Story = {
  args: {
    centerIcon: <Menu />,
    size: 'iconLg',
    variant: 'ghost',
  },
};

/**
 * Button with left icon.
 */
export const WithLeftIcon: Story = {
  args: {
    children: 'Add Item',
    leftIcon: <Plus />,
  },
};

/**
 * Button with right icon.
 */
export const WithRightIcon: Story = {
  args: {
    children: 'Next',
    rightIcon: <ChevronRight />,
  },
};

/**
 * Button with both icons.
 */
export const WithBothIcons: Story = {
  args: {
    children: 'Download',
    leftIcon: <Download />,
    rightIcon: <ChevronRight />,
  },
};

// === States ===

/**
 * Disabled button.
 */
export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

/**
 * Loading button.
 */
export const Loading: Story = {
  args: {
    children: 'Loading...',
    loading: true,
  },
};

/**
 * Button as link (with href).
 */
export const AsLink: Story = {
  args: {
    children: 'Go to Home',
    href: '/',
  },
};

/**
 * Button opening link in new tab.
 */
export const NewTabLink: Story = {
  args: {
    children: 'External Link',
    href: 'https://example.com',
    openInNewTab: true,
  },
};

/**
 * Button with external link icon on hover.
 */
export const ExternalLinkOnHover: Story = {
  args: {
    children: 'View Documentation',
    href: 'https://docs.example.com',
    showExternalLinkOnHover: true,
  },
};

// === Layout Options ===

/**
 * Left-aligned button content.
 */
export const AlignedLeft: Story = {
  args: {
    children: 'Left Aligned',
    alignment: 'left',
    variant: 'outline',
    leftIcon: <Settings />,
  },
};

/**
 * Button with no padding.
 */
export const NoPadding: Story = {
  args: {
    children: 'No Padding',
    variant: 'transparent',
    noPadding: true,
  },
};

/**
 * Button not full width on mobile.
 */
export const NotFullWidthOnMobile: Story = {
  args: {
    children: 'Fixed Width',
    fullWidthOnMobile: false,
  },
};

// === Showcase ===

/**
 * All primary variants displayed together.
 */
export const AllVariants: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="white">White</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="transparent">Transparent</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="info">Info</Button>
    </div>
  ),
};

/**
 * All size variants displayed together.
 */
export const AllSizes: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="touch">Touch</Button>
    </div>
  ),
};

/**
 * Icon button variations.
 */
export const IconButtons: Story = {
  args: {
    children: 'Icon',
  },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="outline" size="icon" centerIcon={<Plus />} />
      <Button variant="ghost" size="icon" centerIcon={<Settings />} />
      <Button variant="destructive" size="icon" centerIcon={<Trash2 />} />
      <Button variant="ghost" size="iconLg" centerIcon={<Menu />} />
      <Button variant="outline" size="icon" centerIcon={<X />} />
    </div>
  ),
};

/**
 * Icon buttons with numbers inside.
 */
export const IconButtonsWithNumber: Story = {
  args: {
    children: 'Icon with Number',
  },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="outline" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>1</span>} />
      <Button variant="outline" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>2</span>} />
      <Button variant="outline" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>3</span>} />
      <Button variant="primary" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>4</span>} />
      <Button variant="ghost" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>5</span>} />
      <Button variant="destructive" size="icon" centerIcon={<span style={{ fontSize: '16px', fontWeight: 'bold' }}>99</span>} />
    </div>
  ),
};

/**
 * Large icon buttons with numbers.
 */
export const IconButtonsLargeWithNumber: Story = {
  args: {
    children: 'Large Icon with Number',
  },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="outline" size="icon" className="!h-9 !w-9 sm:!w-9">1</Button>
      <Button variant="outline" size="iconLg" centerIcon={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>2</span>} />
      <Button variant="primary" size="iconLg" centerIcon={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>10</span>} />
      <Button variant="secondary" size="iconLg" centerIcon={<span style={{ fontSize: '18px', fontWeight: 'bold' }}>25</span>} />
    </div>
  ),
};

/**
 * Icon buttons with icon and number combined.
 */
export const IconButtonsWithIconAndNumber: Story = {
  args: {
    children: 'Icon and Number',
  },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="outline" size="default" leftIcon={<Bell />}>3</Button>
      <Button variant="outline" size="default" leftIcon={<MessageSquare />}>12</Button>
      <Button variant="primary" size="default" leftIcon={<ShoppingCart />}>5</Button>
      <Button variant="ghost" size="default" leftIcon={<Heart />}>99</Button>
    </div>
  ),
};

/**
 * Buttons with icons showcase.
 */
export const WithIconsShowcase: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px' }}>
      <Button leftIcon={<Plus />}>Add Item</Button>
      <Button rightIcon={<ChevronRight />}>Continue</Button>
      <Button leftIcon={<Download />} rightIcon={<ChevronRight />}>Download All</Button>
      <Button variant="destructive" leftIcon={<Trash2 />}>Delete</Button>
      <Button variant="outline" leftIcon={<Search />}>Search</Button>
    </div>
  ),
};

/**
 * Button states showcase.
 */
export const StatesShowcase: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px' }}>
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
      <Button loading disabled>Loading Disabled</Button>
    </div>
  ),
};

/**
 * Flamingo theme buttons.
 */
export const FlamingoTheme: Story = {
  args: {
    children: 'Button',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px' }}>
      <Button variant="flamingo-primary">Flamingo Primary</Button>
      <Button variant="flamingo-secondary">Flamingo Secondary</Button>
    </div>
  ),
};
