import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
});

const item = () => document.querySelector<HTMLElement>('[role="option"]');

function mount(description?: string) {
  flushSync(() =>
    root.render(
      <Select open defaultValue="notify">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="notify" description={description}>
            Notify Only
          </SelectItem>
        </SelectContent>
      </Select>,
    ),
  );
}

describe('SelectItem description', () => {
  it('renders the label alone on a fixed-height, non-wrapping row', () => {
    mount();
    const row = item();
    expect(row?.textContent).toBe('Notify Only');
    expect(row?.className).toContain('whitespace-nowrap');
    expect(row?.className).not.toContain('min-h-11');
  });

  it('adds the description as a second line and lets the row grow and wrap', () => {
    mount('No approval prompt. The user sees the session block, can chat and can end the session.');
    const row = item();
    expect(row?.textContent).toContain('can end the session.');
    expect(row?.className).toContain('whitespace-normal');
    expect(row?.className).toContain('min-h-11');
    expect(row?.className).not.toContain('whitespace-nowrap');
  });

  it('keeps the description out of the trigger mirror', () => {
    mount('A long description.');
    const trigger = document.querySelector('[role="combobox"]');
    expect(trigger?.textContent).toContain('Notify Only');
    expect(trigger?.textContent).not.toContain('A long description.');
  });
});
