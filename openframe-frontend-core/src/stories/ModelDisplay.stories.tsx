import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ReactNode, useState } from 'react';

import { ModelDisplay } from '../components/chat/model-display';
import type { ModelMenu } from '../components/chat/types';
import { AnthropicLogoGreyIcon, OpenaiLogoGreyIcon, ShieldCheckIcon } from '../components/icons-v2-generated';
import type { ActionsMenuItem } from '../components/ui/actions-menu';

/** Name, rate read, rate written. */
type StoryModel = [string, number, number];

const ANTHROPIC: StoryModel[] = [
  ['Claude Opus 5.5', 1.33, 6.67],
  ['Claude Sonnet 5.5', 0.67, 3.33],
  ['Claude Fable 5', 3.33, 16.67],
  ['Claude Opus 5', 1.67, 8.33],
  ['Claude Sonnet 5', 0.67, 3.33],
  ['Claude Opus 4.8', 1.67, 8.33],
  ['Claude Opus 4.7', 1.67, 8.33],
  ['Claude Sonnet 4.6', 1, 5],
  ['Claude Haiku 4.5', 0.33, 1.67],
  ['Claude Opus 4.1', 1.67, 8.33],
  ['Claude Sonnet 4', 1, 5],
  ['Claude Opus 4', 1.67, 8.33],
];
const OPENAI: StoryModel[] = [
  ['GPT-5.5', 1.25, 10],
  ['GPT-5.5 mini', 0.25, 2],
];

/** 1× is $10 per 1M tokens: whole dollars from $10, cents under it. */
function price(rate: number): string {
  const amount = rate * 10;
  return amount >= 10 ? `$${Math.round(amount)}` : `$${amount.toFixed(2)}`;
}

const footer = (
  <div className="w-[438px] min-w-full max-w-full font-normal text-ods-text-secondary text-note">
    <p className="border-b border-ods-border px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
      Rate: OpenFrame tokens charged per token read / written.
      <br />
      Price: per 1M tokens, read / write.
    </p>
    <div className="flex items-start gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
      <ShieldCheckIcon aria-hidden size={16} className="shrink-0" />
      <p>
        Your chats aren’t used to train AI models. Model providers keep requests for up to 30 days, then delete them.
      </p>
    </div>
  </div>
);

function ModelMenuRow({ disabled = false }: { disabled?: boolean }) {
  const [model, setModel] = useState<string | null>(null);
  const shown = model ?? 'Claude Opus 4.8';
  const provider = (name: string, icon: ReactNode, models: StoryModel[]): ActionsMenuItem => ({
    id: name,
    label: name,
    icon,
    type: 'submenu',
    submenuBoundary: 'viewport',
    submenuAlign: 'end',
    checked: models.some(([label]) => label === shown),
    footer,
    submenu: models.map(([label, read, written]) => ({
      id: label,
      label,
      type: 'radio',
      checked: label === shown,
      aside: (
        <span className="flex gap-[var(--spacing-system-xsf)] font-normal">
          <span>
            {read}× / {written}×
          </span>
          <span>
            {price(read)} / {price(written)}
          </span>
        </span>
      ),
      onClick: label === shown ? undefined : () => setModel(label),
    })),
  });
  const menu: ModelMenu = {
    disabled,
    groups: [
      {
        items: [
          model === null
            ? { id: 'default', label: 'Using default model', disabled: true }
            : { id: 'default', label: 'Use default model', onClick: () => setModel(null) },
          { id: 'separator', label: '', type: 'separator' },
          provider('Anthropic', <AnthropicLogoGreyIcon />, ANTHROPIC),
          provider('OpenAI', <OpenaiLogoGreyIcon />, OPENAI),
        ],
      },
    ],
  };
  return (
    <div className="flex h-screen items-end bg-ods-bg p-[var(--spacing-system-l)]">
      <ModelDisplay
        className="w-full max-w-[720px]"
        provider={OPENAI.some(([label]) => label === shown) ? 'openai' : 'anthropic'}
        modelName={shown}
        usedTokens={372}
        contextWindow={50_000}
        modelMenu={menu}
      />
    </div>
  );
}

const meta = {
  title: 'Chat/ModelDisplay',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The composer's model row with the host's model menu: providers, then each provider's models over a fixed note. */
export const WithModelMenu: Story = {
  render: () => <ModelMenuRow />,
};

/** The model cannot change now (a reply streams): the name stays, the menu does not open. */
export const ModelMenuLocked: Story = {
  render: () => <ModelMenuRow disabled />,
};
