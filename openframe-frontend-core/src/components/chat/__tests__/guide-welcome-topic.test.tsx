/**
 * The chat's empty state prints the page's topic (its path) above its quick
 * actions when the host asks (`showTopic`), with the SAME label and source as
 * the FAQ block, so whoever edits quick actions sees which page's chips the
 * page asked for.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageTopicsProvider } from '../../../contexts/page-topics-context';
import { GuideWelcome } from '../guide-welcome';

const ACTIONS = [{ id: 'a', label: 'How does pricing work?' }];

function renderWelcome(pathname: string, showTopic?: boolean) {
  return render(
    <PageTopicsProvider pathname={pathname}>
      <GuideWelcome quickActions={ACTIONS} showTopic={showTopic} />
    </PageTopicsProvider>,
  );
}

describe('GuideWelcome showTopic', () => {
  it("prints the page's topic, the label the FAQ block prints", () => {
    renderWelcome('/pricing', true);
    expect(screen.getByText('/pricing').dataset.pageTopic).toBe('/pricing');
  });

  it('prints nothing unless the host asks', () => {
    renderWelcome('/pricing');
    expect(screen.queryByText('/pricing')).toBeNull();
  });

  it('prints nothing where the host gave no page topics', () => {
    render(<GuideWelcome quickActions={ACTIONS} showTopic />);
    expect(screen.queryByTitle('Page topic')).toBeNull();
  });
});
