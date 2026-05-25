'use client'

import * as React from 'react'
import { HexColorPicker } from 'react-colorful'
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon'
import { Popover, PopoverContent, PopoverTrigger } from '../popover'
import { cn } from '../../utils/cn'
import { HEX_PATTERN, hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from '../../utils/ods-color-utils'
import { ActionsMenuDropdown, type ActionsMenuGroup } from './actions-menu'
import { Input } from './input'
import { InputTrigger } from './input-trigger'

export interface ColorPreset {
  key: string
  label: string
  color: string
}

// Hex (not tokens): values round-trip through inline `style` on the tag preview.
export const TICKET_STATUS_COLOR_PRESETS: readonly ColorPreset[] = [
  { key: 'red', label: 'Red', color: '#f36666' },
  { key: 'green', label: 'Green', color: '#5ea62e' },
  { key: 'yellow', label: 'Yellow', color: '#e1b32f' },
  { key: 'sky', label: 'Sky', color: '#4fc3f7' },
  { key: 'purple', label: 'Purple', color: '#a78bfa' },
  { key: 'pink', label: 'Pink', color: '#f48fb1' },
]

export const CUSTOM_PRESET_KEY = 'custom'
export const DEFAULT_CUSTOM_STATUS_COLOR = '#888888'

function ColorSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 shrink-0 rounded-sm', className)}
      style={{ backgroundColor: color }}
    />
  )
}

function TriggerChevron() {
  return (
    <Chevron02DownIcon
      size={24}
      className="transition-transform duration-200 group-data-[state=open]:rotate-180"
    />
  )
}

export interface ColorPresetSelectProps {
  value: string
  presetKey?: string
  onChange: (next: { color: string; preset?: string }) => void
  presets?: readonly ColorPreset[]
  disabled?: boolean
  className?: string
}

export function ColorPresetSelect({
  value,
  presetKey,
  onChange,
  presets = TICKET_STATUS_COLOR_PRESETS,
  disabled,
  className,
}: ColorPresetSelectProps) {
  const selectedPreset = presets.find(p => p.key === presetKey)
  const isCustom = !selectedPreset
  const displayLabel = selectedPreset?.label ?? 'Custom'
  const displayColor = selectedPreset?.color ?? value

  const groups: ActionsMenuGroup[] = [
    {
      items: [
        ...presets.map(p => ({
          id: p.key,
          label: p.label,
          icon: <ColorSwatch color={p.color} />,
          onClick: () => onChange({ color: p.color, preset: p.key }),
        })),
        {
          id: CUSTOM_PRESET_KEY,
          label: 'Custom',
          icon: <ColorSwatch color={isCustom ? value : DEFAULT_CUSTOM_STATUS_COLOR} />,
          onClick: () => onChange({ color: value, preset: undefined }),
        },
      ],
    },
  ]

  return (
    <ActionsMenuDropdown
      groups={groups}
      align="start"
      sideOffset={4}
      customTrigger={
        <InputTrigger
          disabled={disabled}
          aria-label={`Color: ${displayLabel}`}
          startIcon={<ColorSwatch color={displayColor} />}
          selectedLabel={displayLabel}
          endIcon={<TriggerChevron />}
          className={cn('group', className)}
        />
      }
    />
  )
}

// ---------------------------------------------------------------------------
// ColorPickerInput — saturation/value + hue + HEX/RGB/HSL inputs
// Public contract: `value` and `onChange` are always hex (#rrggbb).
// Conversion helpers live in `utils/ods-color-utils`.
// ---------------------------------------------------------------------------

const FORMATS = ['HEX', 'RGB', 'HSL'] as const
type ColorFormat = (typeof FORMATS)[number]

// Channel inputs are number-shaped and centered; HEX is text-shaped and left-aligned.
// Both target the Input component's inner <input> via the descendant selector.
// `flex-1 min-w-0` lets each input share the row width and shrink below content;
// without it, Input's `w-full` outer makes siblings overflow the popover.
const channelInputClass = 'flex-1 min-w-0 [&_input]:text-center [&_input]:tabular-nums'
const hexInputClass = 'flex-1 min-w-0 [&_input]:uppercase'

function HexInputs({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])

  const commit = () => {
    const candidate = (draft.startsWith('#') ? draft : `#${draft}`).toLowerCase()
    if (HEX_PATTERN.test(candidate)) onChange(candidate)
    else setDraft(value)
  }

  return (
    <Input
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      spellCheck={false}
      aria-label="Hex color value"
      className={hexInputClass}
    />
  )
}

function ChannelInput({
  value,
  min,
  max,
  ariaLabel,
  onCommit,
}: {
  value: number
  min: number
  max: number
  ariaLabel: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = React.useState(String(value))
  React.useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const parsed = Number.parseInt(draft, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    onCommit(Math.max(min, Math.min(max, parsed)))
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      aria-label={ariaLabel}
      className={channelInputClass}
    />
  )
}

function RgbInputs({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 }
  const update = (next: { r?: number; g?: number; b?: number }) => {
    const r = next.r ?? rgb.r
    const g = next.g ?? rgb.g
    const b = next.b ?? rgb.b
    onChange(rgbToHex(r, g, b))
  }
  return (
    <>
      <ChannelInput value={rgb.r} min={0} max={255} ariaLabel="Red" onCommit={r => update({ r })} />
      <ChannelInput value={rgb.g} min={0} max={255} ariaLabel="Green" onCommit={g => update({ g })} />
      <ChannelInput value={rgb.b} min={0} max={255} ariaLabel="Blue" onCommit={b => update({ b })} />
    </>
  )
}

function HslInputs({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const rgb = hexToRgb(value) ?? { r: 0, g: 0, b: 0 }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
  const update = (next: { h?: number; s?: number; l?: number }) => {
    const h = next.h ?? hsl.h
    const s = next.s ?? hsl.s
    const l = next.l ?? hsl.l
    const out = hslToRgb(h, s, l)
    onChange(rgbToHex(out.r, out.g, out.b))
  }
  return (
    <>
      <ChannelInput value={hsl.h} min={0} max={360} ariaLabel="Hue" onCommit={h => update({ h })} />
      <ChannelInput value={hsl.s} min={0} max={100} ariaLabel="Saturation" onCommit={s => update({ s })} />
      <ChannelInput value={hsl.l} min={0} max={100} ariaLabel="Lightness" onCommit={l => update({ l })} />
    </>
  )
}

export interface ColorPickerInputProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
  className?: string
}

export function ColorPickerInput({ value, onChange, disabled, className }: ColorPickerInputProps) {
  const [open, setOpen] = React.useState(false)
  const [format, setFormat] = React.useState<ColorFormat>('HEX')

  const formatGroups: ActionsMenuGroup[] = [
    {
      items: FORMATS.map(f => ({
        id: f,
        label: f,
        onClick: () => setFormat(f),
      })),
    },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InputTrigger
          disabled={disabled}
          aria-label="Pick custom color"
          startIcon={<ColorSwatch color={value} />}
          selectedLabel={<span className="uppercase">{value}</span>}
          endIcon={<TriggerChevron />}
          className={cn('group', className)}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="z-[1400] w-[320px] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] text-ods-text-primary shadow-md [&_.react-colorful]:!w-full [&_.react-colorful]:!h-[190px] [&_.react-colorful\\_\\_saturation]:!rounded-sm [&_.react-colorful\\_\\_last-control]:!rounded-lg [&_.react-colorful\\_\\_hue]:!h-4 [&_.react-colorful\\_\\_hue]:!mt-[var(--spacing-system-m)]"
      >
        <div className="flex flex-col gap-[var(--spacing-system-m)]">
          <HexColorPicker color={value} onChange={onChange} />
          <div className="flex items-center gap-[var(--spacing-system-xs)]">
            <ActionsMenuDropdown
              groups={formatGroups}
              align="start"
              sideOffset={4}
              contentClassName="z-[1500]"
              customTrigger={
                <InputTrigger
                  aria-label={`Color format: ${format}`}
                  selectedLabel={format}
                  endIcon={<TriggerChevron />}
                  className="group w-24 shrink-0"
                />
              }
            />
            <div className="flex flex-1 min-w-0 items-center gap-[var(--spacing-system-xs)]">
              {format === 'HEX' && <HexInputs value={value} onChange={onChange} />}
              {format === 'RGB' && <RgbInputs value={value} onChange={onChange} />}
              {format === 'HSL' && <HslInputs value={value} onChange={onChange} />}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

