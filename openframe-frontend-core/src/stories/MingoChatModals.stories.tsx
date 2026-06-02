import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import * as React from 'react'
import {
  RenameChatModal,
  ArchiveChatModal,
} from '../components/chat/mingo-chat-modals'

const meta: Meta = {
  title: 'Chat/MingoChatModals',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Rename Chat (Figma `7592:225962`) and Archive Chat (Figma `7592:226181`) modals, triggered from the chat header `⋯` and the dialog-history row menus. Built on `ModalV2` (Azeret Mono title, p-40 / gap-24, in-house overlay).',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[100dvh] bg-ods-bg">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj

/** Rename Chat — input seeded with the current name, Cancel + Save. */
export const Rename: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <button
          type="button"
          className="m-8 rounded-md bg-ods-accent px-4 py-2 text-h3 text-ods-text-on-accent"
          onClick={() => setOpen(true)}
        >
          Open Rename modal
        </button>
        <RenameChatModal
          isOpen={open}
          initialName="Troubleshooting Exchange Online connection issues"
          onClose={() => setOpen(false)}
          onSave={(name) => {
            console.log('save', name)
            setOpen(false)
          }}
        />
      </>
    )
  },
}

/** Archive Chat — confirmation with a destructive red action. */
export const Archive: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <button
          type="button"
          className="m-8 rounded-md bg-ods-accent px-4 py-2 text-h3 text-ods-text-on-accent"
          onClick={() => setOpen(true)}
        >
          Open Archive modal
        </button>
        <ArchiveChatModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onConfirm={() => {
            console.log('archive confirmed')
            setOpen(false)
          }}
        />
      </>
    )
  },
}
