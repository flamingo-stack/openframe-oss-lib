import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { AgentIdentityProvider } from '../agent-identity';
import { AgentMark } from '../agent-mark';
import { EntityIcon } from '../icon-display';

const FAE_URL = 'https://files.test/fae.webp';

/** What the marks rendered. They are decorative (no accessible role), so the markup is read. */
const markup = (ui: ReactNode): string => {
  render(<div data-testid="marks">{ui}</div>);
  return screen.getByTestId('marks').innerHTML;
};

describe("an agent's mark is its identity's icon", () => {
  it('draws the uploaded picture for AgentMark and for EntityIcon named by the slug', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ fae: { name: null, url: FAE_URL } }}>
        <AgentMark agent="fae" />
        <EntityIcon icon={{ name: 'fae' }} size={24} />
      </AgentIdentityProvider>,
    );
    expect(html.match(/fae\.webp/g)).toHaveLength(2);
    expect(html).not.toContain('data:image');
  });

  it('keeps the packaged marks when the host names no identity icon', () => {
    const html = markup(
      <>
        <AgentMark agent="fae" />
        <AgentMark agent="mingo" />
      </>,
    );
    expect(html).toContain('data:image');
    expect(html).toContain('<svg');
  });

  it("keeps the packaged mark for an identity that names the agent's own mark", () => {
    const html = markup(
      <AgentIdentityProvider icons={{ mingo: { name: 'mingo', url: null } }}>
        <AgentMark agent="mingo" />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('<svg');
    expect(html).not.toContain('<img');
  });

  it('lets an icon with its own picture win over the identity', () => {
    const html = markup(
      <AgentIdentityProvider icons={{ fae: { url: FAE_URL } }}>
        <EntityIcon icon={{ name: 'fae', url: 'https://files.test/own.webp' }} />
      </AgentIdentityProvider>,
    );
    expect(html).toContain('own.webp');
    expect(html).not.toContain('fae.webp');
  });
});
