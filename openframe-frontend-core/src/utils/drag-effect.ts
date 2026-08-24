/**
 * Holds a native drag started from `element` to the "move" effect, from its very
 * first frame.
 *
 * The browser picks the drag cursor from `dataTransfer.dropEffect`, and the
 * value it starts each drag with comes from `effectAllowed`. Pragmatic never
 * writes `effectAllowed`, so it stays `uninitialized` — which the browser reads
 * as "all", whose initial `dropEffect` is `copy`. That is the green plus cursor
 * flashing for one frame at the start of every drag, before the first `dragover`
 * has had a chance to say otherwise.
 *
 * This is a raw listener rather than a Pragmatic callback because `effectAllowed`
 * can only be written during the `dragstart` event itself, and none of
 * Pragmatic's callbacks are handed the event.
 *
 * Distinct from `preventUnhandled`, which answers the other half of the same
 * question: this sets what the drag starts as, that keeps it from falling back
 * to "no drop" over everything that is not a drop target.
 */
export function holdMoveDragEffect(element: HTMLElement): () => void {
  const onDragStart = (event: DragEvent) => {
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }
  element.addEventListener('dragstart', onDragStart)
  return () => element.removeEventListener('dragstart', onDragStart)
}
