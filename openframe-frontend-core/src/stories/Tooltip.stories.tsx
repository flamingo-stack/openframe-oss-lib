import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Info, HelpCircle, Settings, Copy, Check, Trash2, Download, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import { Button } from '../components/ui/button'

const meta = {
  title: 'UI/Tooltip',
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center justify-center min-h-[200px] gap-6 p-8">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic tooltip on an icon button.
 */
export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="p-2 rounded-md hover:bg-ods-bg-hover text-ods-text-secondary transition-colors">
          <Settings className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
  ),
}

/**
 * Info icon with an explanatory tooltip — common pattern for forms and dashboards.
 */
export const InfoHelper: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-sm text-ods-text-primary">
      <span>Monthly active users</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-4 w-4 text-ods-text-secondary cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px]">
          <p className="text-xs">Unique users who performed at least one action in the last 30 days.</p>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
}

/**
 * Tooltip positioning — all four sides.
 */
export const Placement: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 items-center justify-items-center w-[300px]">
      <div />
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-2 rounded-md bg-ods-card border border-ods-border text-ods-text-primary text-xs">
            Top
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Tooltip on top</TooltipContent>
      </Tooltip>
      <div />

      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-2 rounded-md bg-ods-card border border-ods-border text-ods-text-primary text-xs">
            Left
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Tooltip on left</TooltipContent>
      </Tooltip>
      <div />
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-2 rounded-md bg-ods-card border border-ods-border text-ods-text-primary text-xs">
            Right
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Tooltip on right</TooltipContent>
      </Tooltip>

      <div />
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-2 rounded-md bg-ods-card border border-ods-border text-ods-text-primary text-xs">
            Bottom
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
      </Tooltip>
      <div />
    </div>
  ),
}

/**
 * Icon toolbar with tooltips — common pattern for action bars.
 */
export const IconToolbar: Story = {
  render: () => (
    <div className="flex items-center gap-1 p-2 rounded-lg bg-ods-card border border-ods-border">
      {[
        { icon: Copy, label: 'Copy' },
        { icon: Download, label: 'Download' },
        { icon: Share2, label: 'Share' },
        { icon: Trash2, label: 'Delete' },
      ].map(({ icon: Icon, label }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button className="p-2 rounded-md hover:bg-ods-bg-hover text-ods-text-secondary hover:text-ods-text-primary transition-colors">
              <Icon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
}

/**
 * Tooltip on a disabled button — uses a wrapper span so the trigger still receives hover events.
 */
export const DisabledButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-block">
          <Button variant="primary" size="sm" disabled>
            Deploy
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>You need admin permissions to deploy.</TooltipContent>
    </Tooltip>
  ),
}

/**
 * Truncated text with a tooltip showing the full value.
 */
export const TruncatedText: Story = {
  render: () => (
    <div className="w-[180px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-sm text-ods-text-primary truncate cursor-default">
            This is a very long text string that will be truncated in the container
          </p>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          This is a very long text string that will be truncated in the container
        </TooltipContent>
      </Tooltip>
    </div>
  ),
}

/**
 * Tooltip with rich content — icon + multiline text.
 */
export const RichContent: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="p-2 rounded-md hover:bg-ods-bg-hover text-ods-text-secondary transition-colors">
          <HelpCircle className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-ods-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold mb-1">Keyboard shortcut</p>
            <p className="text-xs text-ods-text-secondary">
              Press <kbd className="px-1 py-0.5 rounded bg-ods-bg-secondary text-ods-text-secondary text-[10px] font-mono">Ctrl+K</kbd> to open the command palette.
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  ),
}

/**
 * Copy-to-clipboard button with tooltip state change on click.
 */
export const CopyButton: Story = {
  render: function CopyButtonStory() {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="p-2 rounded-md hover:bg-ods-bg-hover text-ods-text-secondary hover:text-ods-text-primary transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-ods-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
      </Tooltip>
    )
  },
}
