import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProductScreen } from '../components/product-demo';
import type { ProductScreenKey } from '../components/product-demo/screen-keys';
import { AppWindowFrame } from '../components/ui/app-window-frame';
import { PRODUCT_SCREEN_READABLE_WIDTH } from '../components/ui/product-screen-frame';

/**
 * A product screen in an app window, as a product page's hero draws it (multi-platform-hub `openframe-hero.tsx`): the
 * screen laid out at the readable width and scaled to the window from a 480px frame, the product's narrow layout
 * under that. The Devices screen draws the grid table at every width; in the
 * narrow layout (a phone) it is at its real size and the columns past the edge are cut.
 */
function HeroWindow({ screen }: { screen: ProductScreenKey }) {
  return (
    <AppWindowFrame title="OpenFrame" className="h-[560px] w-full" bodyClassName="relative">
      <ProductScreen
        screen={screen}
        height={520}
        designWidth={PRODUCT_SCREEN_READABLE_WIDTH}
        scaleFrom={480}
        appType="openframe"
      />
    </AppWindowFrame>
  );
}

const meta = {
  title: 'Product demo/Hero window',
  component: HeroWindow,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <div className="bg-ods-bg p-[var(--spacing-system-lf)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HeroWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Devices screen, the OpenFrame page hero's. */
export const Devices: Story = { args: { screen: 'devices' } };
