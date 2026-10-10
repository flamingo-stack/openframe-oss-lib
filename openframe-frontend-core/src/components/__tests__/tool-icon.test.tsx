import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { ToolTypeValues, type ToolType } from '../../types/tool.types';
import { ToolIcon } from '../tool-icon';

/** A tool's mark is loaded from the icon set when the tool is drawn; these hold every tool to a mark the set has. */
describe('ToolIcon', () => {
  const tools = Object.values(ToolTypeValues) as ToolType[];

  it.each(tools.filter(tool => tool !== ToolTypeValues.SYSTEM))(
    'draws the mark of %s from the icon set',
    async tool => {
      render(createElement('div', { 'data-testid': 'slot' }, createElement(ToolIcon, { toolType: tool, size: 20 })));
      const slot = await screen.findByTestId('slot');
      await expect.poll(() => slot.innerHTML).toContain('<svg');
      expect(slot.innerHTML).toContain('width="20"');
    },
  );

  it('draws nothing for the system tool', () => {
    render(
      createElement('div', { 'data-testid': 'slot' }, createElement(ToolIcon, { toolType: ToolTypeValues.SYSTEM })),
    );
    expect(screen.getByTestId('slot').innerHTML).toBe('');
  });
});
