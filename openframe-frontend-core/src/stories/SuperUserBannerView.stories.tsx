import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SuperUserBannerView } from '../components/ui/super-user-banner-view';

const meta = {
  title: 'UI/SuperUserBannerView',
  component: SuperUserBannerView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SuperUserBannerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Production: Story = {
  args: { tenantName: 'Atlas Manufacturing Corp', environmentLabel: 'Production environment' },
};

export const NoEnvironment: Story = {
  args: { tenantName: 'Atlas Manufacturing Corp' },
};

export const LongTenantName: Story = {
  args: {
    tenantName: 'Flamingo Managed Services and Technology Solutions International Holdings Limited',
    environmentLabel: 'Production environment',
  },
};
