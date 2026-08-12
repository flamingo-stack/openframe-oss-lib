import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { mockReplace, setMockSearchParams } from '../../../../vitest.setup'
import { TabNavigation, type TabItem } from '../tab-navigation'

beforeAll(() => {
  // jsdom ships no ResizeObserver; the tab strip observes itself on mount to
  // keep the edge fades and the underline in sync with its own width.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const TABS: TabItem[] = [
  { id: 'general', label: 'General' },
  { id: 'software', label: 'Software' },
]

/**
 * Renders with `urlSync` and reports the tab id the BODY was last rendered with
 * — the one thing a consumer actually observes, and the value the deferred
 * render settles on once React has flushed.
 */
function renderNav(tabs: TabItem[]) {
  let seen = '__never-rendered__'
  const element = (next: TabItem[]) => (
    <TabNavigation tabs={next} urlSync>
      {(active) => {
        seen = active
        return null
      }}
    </TabNavigation>
  )
  const utils = render(element(tabs))
  return {
    get active() {
      return seen
    },
    rerenderWith(next: TabItem[]) {
      utils.rerender(element(next))
    },
  }
}

describe('TabNavigation with urlSync', () => {
  describe('a tab list that arrives late', () => {
    // The sync effect is guarded on the URL value changing, so that our own
    // `router.replace` doesn't come back looking like someone else's edit. The
    // guard must not also swallow the tabs themselves arriving — an empty list
    // resolves to no active tab, and the URL never moves again to correct it.
    it('applies the deep-linked tab once the tabs arrive', () => {
      setMockSearchParams(new URLSearchParams('tab=software'))
      const nav = renderNav([])
      expect(nav.active).toBe('')

      nav.rerenderWith(TABS)
      expect(nav.active).toBe('software')
    })

    it('falls back to the first tab once the tabs arrive', () => {
      const nav = renderNav([])
      expect(nav.active).toBe('')

      nav.rerenderWith(TABS)
      expect(nav.active).toBe('general')
    })

    it('leaves a tab the user picked alone when the tabs array is merely re-created', () => {
      const nav = renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))
      expect(nav.active).toBe('software')

      // Same ids, new array + new Set identity — what a consumer passing an
      // inline literal produces on every one of its renders.
      nav.rerenderWith([...TABS])
      expect(nav.active).toBe('software')
    })
  })

  describe('clicking a tab', () => {
    // The regression this component was rewritten for: state moves on click,
    // `router.replace` lands a tick or more later, and an effect comparing the
    // state against the URL in between would read the tab just LEFT and push
    // the tab back to it.
    it('does not revert before the navigation lands', () => {
      const nav = renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))

      // The URL has deliberately NOT been updated here — this is the window in
      // which the old effect fought its own click.
      expect(nav.active).toBe('software')
    })

    it('writes the tab to the URL without scrolling to the top', () => {
      renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))

      expect(mockReplace).toHaveBeenCalledWith('/?tab=software', { scroll: false })
    })

    it('stays put when its own write finally lands', () => {
      const nav = renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))

      setMockSearchParams(new URLSearchParams('tab=software'))
      nav.rerenderWith(TABS)
      expect(nav.active).toBe('software')
    })

    // Two clicks inside one navigation: the FIRST write lands while the second
    // is still in flight. Arriving out of step like that, it is indistinguishable
    // from an external change unless the component remembers what it wrote.
    it('ignores an earlier write landing after a second click', () => {
      const nav = renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))
      fireEvent.click(screen.getByText('General'))
      expect(nav.active).toBe('general')

      setMockSearchParams(new URLSearchParams('tab=software'))
      nav.rerenderWith(TABS)
      expect(nav.active).toBe('general')

      setMockSearchParams(new URLSearchParams('tab=general'))
      nav.rerenderWith(TABS)
      expect(nav.active).toBe('general')
    })

    it('keeps unrelated query params', () => {
      setMockSearchParams(new URLSearchParams('page=2&tab=general'))
      renderNav(TABS)
      fireEvent.click(screen.getByText('Software'))

      expect(mockReplace).toHaveBeenCalledWith('/?page=2&tab=software', { scroll: false })
    })
  })

  describe('an external URL change', () => {
    it('moves the tab (back/forward, or a link into a tab)', () => {
      setMockSearchParams(new URLSearchParams('tab=general'))
      const nav = renderNav(TABS)
      expect(nav.active).toBe('general')

      setMockSearchParams(new URLSearchParams('tab=software'))
      nav.rerenderWith(TABS)
      expect(nav.active).toBe('software')
    })

    it('falls back when the URL names a tab that does not exist', () => {
      setMockSearchParams(new URLSearchParams('tab=general'))
      const nav = renderNav(TABS)

      setMockSearchParams(new URLSearchParams('tab=nonsense'))
      nav.rerenderWith(TABS)
      expect(nav.active).toBe('general')
    })
  })
  describe('the underline', () => {
    it('is sized in real pixels rather than a scaled 1px bar', () => {
      // Regression guard. The underline used to be `w-px` stretched with
      // `scaleX(width)`, which is only exact when one CSS pixel lands on a whole
      // device pixel. At 125%/150% OS scaling or any browser zoom the base is
      // rasterized to the nearest whole device pixel and `scaleX` multiplies
      // that rounding by the tab's width, so the bar rendered visibly shorter or
      // longer than the tab it underlines — while `offsetWidth` had been right
      // all along. Asserting the STYLE (not the pixels, which jsdom has none of)
      // is what keeps the multiplier from coming back.
      const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(120)
      const leftSpy = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(40)

      try {
        setMockSearchParams(new URLSearchParams('tab=general'))
        const { container } = render(
          <TabNavigation tabs={TABS} urlSync>
            {() => null}
          </TabNavigation>
        )

        const underline = container.querySelector('[aria-hidden]') as HTMLElement
        expect(underline.style.width).toBe('120px')
        expect(underline.style.transform).toBe('translateX(40px)')
        expect(underline.style.transform).not.toContain('scaleX')
        expect(underline.className).not.toContain('w-px')
      } finally {
        widthSpy.mockRestore()
        leftSpy.mockRestore()
      }
    })
  })
})
