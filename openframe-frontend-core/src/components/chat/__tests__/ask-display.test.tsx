/**
 * `AskDisplay` — the guide-routing clarification card.
 *
 * Pins the two contracts a host depends on: the picked option's label reaches
 * `onSelect` VERBATIM (the backend resolves the user's reply against the labels
 * it offered, so a reworded send breaks routing), and the card is inert without
 * a handler (replayed history / observer surfaces must not offer a button that
 * would post into someone else's dialog).
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AskDisplay } from '../ask-display'
import type { AskSegment } from '../types/message.types'

const card = (question: string): AskSegment => ({
  type: 'ask',
  question,
  options: [
    { label: 'Find documentation', description: 'How the feature works and how to set it up' },
    { label: 'Work with workspace data' },
  ],
})

describe('AskDisplay', () => {
  it('renders the question, numbered options and their descriptions', () => {
    render(<AskDisplay cards={[card('What do you want to work on?')]} />)

    expect(screen.getByText('What do you want to work on?')).toBeInTheDocument()
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('Find documentation')).toBeInTheDocument()
    expect(screen.getByText('How the feature works and how to set it up')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('Work with workspace data')).toBeInTheDocument()
  })

  it('sends the picked option label verbatim', () => {
    const onSelect = vi.fn()
    render(<AskDisplay cards={[card('Which one?')]} onSelect={onSelect} />)

    fireEvent.click(screen.getByText('Find documentation'))

    expect(onSelect).toHaveBeenCalledWith('Find documentation')
  })

  it('renders locked without a handler: options disabled and veiled', () => {
    const { container } = render(<AskDisplay cards={[card('Which one?')]} />)

    // Kept as buttons on purpose — assistive tech should hear "dimmed button",
    // not read the options as prose that was never actionable.
    const options = screen.getAllByRole('button')
    expect(options).toHaveLength(2)
    for (const option of options) expect(option).toBeDisabled()

    // The veil carries the visible lock: it dims the block, owns the pointer
    // (not-allowed cursor anywhere over it) and explains itself on hover.
    const veil = container.querySelector('[title]')
    expect(veil).toBeTruthy()
    expect(veil?.className).toContain('cursor-not-allowed')
  })

  it('hides the pager for a single card', () => {
    render(<AskDisplay cards={[card('Which one?')]} onSelect={vi.fn()} />)

    expect(screen.queryByText(/of 1/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next question')).not.toBeInTheDocument()
  })

  it('pages through a run of cards, one question at a time', () => {
    render(<AskDisplay cards={[card('First?'), card('Second?')]} onSelect={vi.fn()} />)

    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByText('First?')).toBeInTheDocument()
    expect(screen.queryByText('Second?')).not.toBeInTheDocument()
    // At the first page there is nowhere back to go.
    expect(screen.getByLabelText('Previous question')).toBeDisabled()

    fireEvent.click(screen.getByLabelText('Next question'))

    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Second?')).toBeInTheDocument()
    expect(screen.getByLabelText('Next question')).toBeDisabled()
  })
})
