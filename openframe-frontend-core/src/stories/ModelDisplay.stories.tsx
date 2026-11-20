import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ReactNode, useState } from 'react';

import { ModelDisplay } from '../components/chat/model-display';
import type { ModelMenu } from '../components/chat/types';
import { AnthropicLogoGreyIcon, OpenaiLogoGreyIcon, ShieldCheckIcon } from '../components/icons-v2-generated';

const ANTHROPIC = ['Claude Opus 5.5', 'Claude Sonnet 5.5', 'Claude Fable 5', 'Claude Opus 5', 'Claude Sonnet 5'].concat(
  ['Claude Opus 4.8', 'Claude Opus 4.7', 'Claude Sonnet 4.6', 'Claude Haiku 4.5', 'Claude Opus 4.1'],
  ['Claude Sonnet 4', 'Claude Opus 4', 'Claude Sonnet 3.7', 'Claude Haiku 3.5'],
);
const OPENAI = ['GPT-5.5', 'GPT-5.5 mini'];

const footer = (
  <div className="flex max-w-[440px] items-start gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-mf)] text-ods-text-secondary text-h6">
    <ShieldCheckIcon aria-hidden size={16} className="shrink-0" />
    <p>Your chats aren’t used to train AI models. Model providers keep requests for up to 30 days, then delete them.</p>
  </div>
);

function ModelMenuRow({ disabled = false }: { disabled?: boolean }) {
  const [model, setModel] = useState<string | null>('Claude Opus 4.8');
  const provider = (name: string, icon: ReactNode, models: string[]) => ({
    id: name,
    label: name,
    icon,
    type: 'submenu' as const,
    submenuBoundary: 'viewport' as const,
    checked: model !== null && models.includes(model),
    footer,
    submenu: models.map(label => ({
      id: label,
      label,
      type: 'radio' as const,
      checked: label === model,
      onClick: () => setModel(label),
    })),
  });
  const menu: ModelMenu = {
    disabled,
    groups: [
      {
        separator: true,
        items: [
          {
            id: 'default',
            label: 'Use Default Model',
            type: 'radio',
            checked: model === null,
            onClick: () => setModel(null),
          },
        ],
      },
      {
        items: [
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
        provider={model && OPENAI.includes(model) ? 'openai' : 'anthropic'}
        modelName={model ?? 'Claude Opus 4.8'}
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
