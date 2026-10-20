/**
 * THE click-bubbling rule of a clickable container: its own clicks only.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { isOwnClick } from '../own-click';

function setup(inner: string) {
  const container = document.createElement('div');
  container.innerHTML = inner;
  document.body.appendChild(container);
  const outside = document.createElement('span');
  document.body.appendChild(outside);
  return { container, outside };
}

describe('isOwnClick', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('takes a click on the container or plain content inside it', () => {
    const { container } = setup('<p id="text">Hi</p>');
    expect(isOwnClick(container, container)).toBe(true);
    expect(isOwnClick(container.querySelector('#text'), container)).toBe(true);
  });

  it('leaves out a target outside the container (a portalled descendant) and a non-element target', () => {
    const { container, outside } = setup('<p>Hi</p>');
    expect(isOwnClick(outside, container)).toBe(false);
    expect(isOwnClick(null, container)).toBe(false);
    expect(isOwnClick(document, container)).toBe(false);
  });

  it('leaves out anything inside an element marked data-no-row-click', () => {
    const { container } = setup('<div data-no-row-click><span id="action">Edit</span></div>');
    expect(isOwnClick(container.querySelector('#action'), container)).toBe(false);
  });

  it('with controls, leaves a button, a link or a label inside to itself, but not the container acting as one', () => {
    const { container } = setup(
      '<button id="b">B</button><a id="a" href="#x">A</a><label id="l">L</label><p id="p">P</p>',
    );
    for (const id of ['b', 'a', 'l'])
      expect(isOwnClick(container.querySelector(`#${id}`), container, { controls: true })).toBe(false);
    expect(isOwnClick(container.querySelector('#p'), container, { controls: true })).toBe(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    expect(isOwnClick(button, button, { controls: true })).toBe(true);
  });

  it('without controls, a control inside is still the container’s', () => {
    const { container } = setup('<button id="b">B</button>');
    expect(isOwnClick(container.querySelector('#b'), container)).toBe(true);
  });
});
