import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Autocomplete, type AutocompleteOption } from '../components/ui/autocomplete'
import { Button } from '../components/ui/button'
import { Modal, ModalContent, ModalFooter, ModalHeader, ModalTitle } from '../components/ui/modal'

type ModalStoryMeta = Meta<typeof Modal>

const meta: ModalStoryMeta = {
  title: 'UI/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Deprecated. The compact legacy dialog kept for the confirm modals that have not moved yet — new work uses `ModalV2` (UI/ModalV2), which owns the focus trap, Escape stacking, keyboard-inset handling, the `size` variants and the two-column body. Sizing and two-column layout are NOT available here: the `size` prop and the `TWO_COLUMN_MODAL_*` class-string constants this component used to export were removed once `ModalV2` gained `size` + `ModalV2TwoColumn`. Width is a plain `className` override.',
      },
    },
  },
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    className: {
      control: 'text',
      description: 'Custom className for the modal container',
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default modal with header, content and footer.
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen)

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open Modal
        </Button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <ModalHeader>
            <ModalTitle>Modal Title</ModalTitle>
          </ModalHeader>
          <ModalContent className="px-6 py-4">
            <p className="text-ods-text-secondary">
              This is a basic modal with header, content and footer sections.
            </p>
          </ModalContent>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => setIsOpen(false)}>
              Confirm
            </Button>
          </ModalFooter>
        </Modal>
      </>
    )
  },
}

const autocompleteOptions: AutocompleteOption<string>[] = [
  { label: 'Enterprise', value: 'enterprise' },
  { label: 'Startup', value: 'startup' },
  { label: 'SMB', value: 'smb' },
  { label: 'Government', value: 'government' },
  { label: 'Education', value: 'education' },
  { label: 'Non-Profit', value: 'nonprofit' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Finance', value: 'finance' },
  { label: 'Retail', value: 'retail' },
  { label: 'Technology', value: 'technology' },
]

/**
 * Modal with Autocomplete inside. The Autocomplete dropdown renders inline in
 * the modal's own DOM tree (no portal), so the panel needs `overflow-visible`
 * for the list to escape the dialog box.
 */
export const WithAutocomplete: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    children: null,
  },
  render: function Render(args) {
    const [isOpen, setIsOpen] = useState(args.isOpen)
    const [selected, setSelected] = useState<string[]>(['enterprise'])

    return (
      <>
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open Modal with Autocomplete
        </Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          className="max-w-lg overflow-visible"
        >
          <ModalHeader>
            <ModalTitle>Select Industries</ModalTitle>
          </ModalHeader>
          <ModalContent className="px-6 py-4">
            <Autocomplete
              multiple
              options={autocompleteOptions}
              value={selected}
              onChange={setSelected}
              label="Industries"
              placeholder="Search industries..."
            />
          </ModalContent>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => setIsOpen(false)}>
              Save
            </Button>
          </ModalFooter>
        </Modal>
      </>
    )
  },
}
