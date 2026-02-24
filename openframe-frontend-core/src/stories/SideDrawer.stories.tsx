import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Button } from '../components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  type DrawerSide,
} from '../components/ui/side-drawer'

const meta: Meta<typeof Drawer> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Right: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Right
        </Button>
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>Right Drawer</DrawerTitle>
            <DrawerDescription>This drawer slides in from the right.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-ods-text-secondary">Drawer content goes here.</p>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const Left: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Left
        </Button>
        <DrawerContent side="left">
          <DrawerHeader>
            <DrawerTitle>Left Drawer</DrawerTitle>
            <DrawerDescription>This drawer slides in from the left.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-ods-text-secondary">Drawer content goes here.</p>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const Top: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Top
        </Button>
        <DrawerContent side="top">
          <DrawerHeader>
            <DrawerTitle>Top Drawer</DrawerTitle>
            <DrawerDescription>This drawer slides in from the top.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-ods-text-secondary">Drawer content goes here.</p>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const Bottom: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Bottom
        </Button>
        <DrawerContent side="bottom">
          <DrawerHeader>
            <DrawerTitle>Bottom Drawer</DrawerTitle>
            <DrawerDescription>This drawer slides in from the bottom.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-ods-text-secondary">Drawer content goes here.</p>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const AllSides: Story = {
  render: function Render() {
    const [openSide, setOpenSide] = useState<DrawerSide | null>(null)
    const sides: DrawerSide[] = ['right', 'left', 'top', 'bottom']

    return (
      <div className="flex gap-2">
        {sides.map((side) => (
          <Drawer key={side} open={openSide === side} onOpenChange={(open) => setOpenSide(open ? side : null)}>
            <Button variant="outline" onClick={() => setOpenSide(side)}>
              {side.charAt(0).toUpperCase() + side.slice(1)}
            </Button>
            <DrawerContent side={side}>
              <DrawerHeader>
                <DrawerTitle>{side.charAt(0).toUpperCase() + side.slice(1)} Drawer</DrawerTitle>
                <DrawerDescription>Slides in from the {side}.</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <p className="text-sm text-ods-text-secondary">Content for {side} drawer.</p>
              </DrawerBody>
              <DrawerFooter>
                <Button variant="outline" onClick={() => setOpenSide(null)}>
                  Close
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ))}
      </div>
    )
  },
}

export const WithFooter: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Drawer
        </Button>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer with Footer</DrawerTitle>
            <DrawerDescription>This drawer includes a footer with actions.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-ods-text-secondary">Main content area.</p>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Confirm
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  },
}

export const LongContent: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)

    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Open Drawer
        </Button>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Scrollable Content</DrawerTitle>
            <DrawerDescription>This drawer has enough content to scroll.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="rounded-md border border-ods-border bg-ods-bg p-4"
              >
                <p className="text-sm font-medium text-ods-text-primary">Item {i + 1}</p>
                <p className="text-sm text-ods-text-secondary">Description for item {i + 1}</p>
              </div>
            ))}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    )
  },
}
