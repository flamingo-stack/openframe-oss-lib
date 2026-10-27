import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../button';
import { Tabs, TabsList, TabsTrigger } from '../tabs';

/**
 * A tab takes focus when it is clicked, so a focus ring showed after every click, and a strip that scrolls sideways
 * clipped it to two bars beside the open tab. Every tab's keyboard focus is its hover look (TAB_FOCUS_CLASS).
 */
const ringClasses = (el: HTMLElement) =>
  el.className.split(/\s+/).filter(c => /^focus-visible:ring-(?!0$|offset-0$)/.test(c));

describe('tab focus', () => {
  it('draws no ring on any tab, and shows focus as the tab hover look', () => {
    render(
      <div>
        <Tabs value="a">
          <TabsList variant="admin-rail">
            <TabsTrigger variant="admin-rail" value="a">
              Rail
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value="a">
          <TabsList>
            <TabsTrigger value="a">Default</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="tab">Strip</Button>
      </div>,
    );
    const tabs = [...screen.getAllByRole('tab'), ...screen.getAllByRole('button')];
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect({ tab: tab.textContent, rings: ringClasses(tab) }).toEqual({ tab: tab.textContent, rings: [] });
      expect(tab.className).toContain('focus-visible:text-ods-text-primary');
    }
  });
});
