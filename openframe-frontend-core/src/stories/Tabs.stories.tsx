import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  parameters: {
    docs: {
      description: {
        component:
          'Radix-based Tabs primitives. The default variant is legacy (deprecated — use `TabNavigation` in new code); `variant="admin-rail"` is the sanctioned ODS underline-tab styling for admin config surfaces: transparent list on a bordered scrollable rail, accent underline on the active trigger. Set the variant on BOTH `TabsList` and each `TabsTrigger`.',
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default (legacy) look — kept for un-migrated call sites.
 */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="max-w-xl">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-h6 text-ods-text-secondary">Overview content.</p>
      </TabsContent>
      <TabsContent value="settings">
        <p className="text-h6 text-ods-text-secondary">Settings content.</p>
      </TabsContent>
      <TabsContent value="history">
        <p className="text-h6 text-ods-text-secondary">History content.</p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * The `admin-rail` variant: `TabsList variant="admin-rail"` self-wraps in the
 * bordered, horizontally-scrollable rail; triggers get the accent underline
 * when active and secondary → primary text on hover. Disabled tabs stay
 * visible but inert.
 */
export const AdminRail: Story = {
  render: () => (
    <Tabs defaultValue="rules" className="max-w-2xl">
      <TabsList variant="admin-rail">
        <TabsTrigger variant="admin-rail" value="rules">
          Rules
        </TabsTrigger>
        <TabsTrigger variant="admin-rail" value="repos">
          Repositories
        </TabsTrigger>
        <TabsTrigger variant="admin-rail" value="runs">
          Runs
        </TabsTrigger>
        <TabsTrigger variant="admin-rail" value="billing" disabled>
          Billing
        </TabsTrigger>
      </TabsList>
      <TabsContent value="rules">
        <p className="pt-[var(--spacing-system-mf)] text-h6 text-ods-text-secondary">Rule configuration lives here.</p>
      </TabsContent>
      <TabsContent value="repos">
        <p className="pt-[var(--spacing-system-mf)] text-h6 text-ods-text-secondary">Repository bindings live here.</p>
      </TabsContent>
      <TabsContent value="runs">
        <p className="pt-[var(--spacing-system-mf)] text-h6 text-ods-text-secondary">Sweep runs live here.</p>
      </TabsContent>
    </Tabs>
  ),
};

/**
 * The rail scrolls horizontally when tabs overflow a narrow container —
 * the border stays full-width under the scrolled list.
 */
export const AdminRailOverflow: Story = {
  render: () => (
    <div className="max-w-sm">
      <Tabs defaultValue="t1">
        <TabsList variant="admin-rail">
          {['General', 'Data Sources', 'Executors', 'Prompts', 'Retrieval', 'Transcripts'].map((label, i) => (
            <TabsTrigger key={label} variant="admin-rail" value={`t${i + 1}`}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="t1">
          <p className="pt-[var(--spacing-system-mf)] text-h6 text-ods-text-secondary">General settings.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
