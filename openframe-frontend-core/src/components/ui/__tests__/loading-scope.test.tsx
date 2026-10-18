/**
 * The loading contract: in a `LoadingScope` a component draws its own `<Name>Skeleton` — its static copy for real,
 * every read part a skeleton shape, never a read word and never nothing.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CategoriesCart } from '../../categories-cart';
import { ChatTurn } from '../../chat/chat-turn';
import { EntityAuthorCard } from '../../chat/entity-cards/entity-author-card';
import { PlatformBadge } from '../../features/platform-badge';
import { PushButtonSelector } from '../../features/push-button-selector';
import { Video } from '../../features/video';
import { VideoBitesStrip } from '../../features/video-bites-strip';
import { MetricValue } from '../../metric-value';
import { MSPDisplay } from '../../msp-display';
import { ToolBadge } from '../../platform/ToolBadge';
import { UserDisplay } from '../../user-display';
import { VendorIcon } from '../../vendor-icon';
import { AvatarStack } from '../avatar-stack';
import { BenefitList } from '../benefit-list';
import { LeaderRow } from '../leader-row';
import { LoadingScope, useLoadingScope } from '../loading-scope';
import { StatusBadge } from '../status-badge';
import { TabNavigation } from '../tab-navigation';
import { Tabs, TabsList, TabsTrigger } from '../tabs';

const READ = 'READ-DATA-WORD';
const SURFACE = '.ods-skeleton';

function ScopeFlag() {
  return <span data-testid="flag">{String(useLoadingScope())}</span>;
}

function inScope(node: React.ReactNode) {
  return render(<LoadingScope>{node}</LoadingScope>);
}

describe('LoadingScope', () => {
  it('tells the components inside it that they are a loading state, and nothing outside it', () => {
    render(
      <>
        <ScopeFlag />
        <LoadingScope>
          <ScopeFlag />
        </LoadingScope>
      </>,
    );
    const flags = screen.getAllByTestId('flag');
    expect(flags.map(flag => flag.textContent)).toEqual(['false', 'true']);
  });
});

describe('a component in a scope draws its own skeleton', () => {
  const cases: Array<[string, React.ReactNode, string[]]> = [
    [
      'EntityAuthorCard',
      <EntityAuthorCard
        key="a"
        author={{ full_name: READ, avatar_url: null, job_title: READ }}
        publishedAt={null}
        extraCells={[{ value: READ, label: 'Section' }]}
      />,
      ['Section', 'Published'],
    ],
    [
      'ChatTurn',
      <ChatTurn key="a" name={READ} time={READ}>
        {READ}
      </ChatTurn>,
      [],
    ],
    ['LeaderRow', <LeaderRow key="a" label="Seats" value="" />, ['Seats']],
    ['ToolBadge', <ToolBadge key="a" label={READ} variant="chip" />, []],
    ['MetricValue', <MetricValue key="a" value={READ} label="Generation time" />, ['Generation time']],
    ['UserDisplay', <UserDisplay key="a" name={READ} subtitle={READ} />, []],
    ['MSPDisplay', <MSPDisplay key="a" name={READ} />, []],
    ['VendorIcon', <VendorIcon key="a" vendor={{ title: READ }} />, []],
    ['StatusBadge', <StatusBadge key="a" text={READ} />, []],
    ['AvatarStack', <AvatarStack key="a" people={[{ name: READ }]} />, []],
    ['CategoriesCart', <CategoriesCart key="a" category={{ name: READ, slug: 'x', description: READ } as never} />, []],
    [
      'PushButtonSelector',
      <PushButtonSelector
        key="a"
        title="Platforms"
        helpText="Pick any"
        options={[{ id: '1', name: READ }]}
        selectedIds={[]}
        onSelectionChange={() => {}}
      />,
      ['Platforms', 'Pick any'],
    ],
    ['TabNavigation', <TabNavigation key="a" tabs={[{ id: 'a', label: READ }]} activeTab="a" />, []],
    [
      'TabsTrigger',
      <Tabs key="a" defaultValue="a">
        <TabsList variant="admin-rail">
          <TabsTrigger value="a" variant="admin-rail">
            <span>{READ}</span>
          </TabsTrigger>
          <TabsTrigger value="b" variant="admin-rail">
            Highlights
          </TabsTrigger>
        </TabsList>
      </Tabs>,
      ['Highlights'],
    ],
    ['Video', <Video key="a" url="" layout="centered" />, []],
    ['VideoBitesStrip', <VideoBitesStrip key="a" bites={[]} title="Key moments" />, ['Key moments']],
  ];

  it.each(cases)('%s: skeleton shapes, its static copy, and no read word', (_name, node, staticCopy) => {
    const { container } = inScope(node);
    expect(container.querySelector(SURFACE)).not.toBeNull();
    expect(container.textContent ?? '').not.toContain(READ);
    for (const words of staticCopy) expect(container.textContent).toContain(words);
  });

  it('a tab strip whose labels are static copy draws them for real (inert); read labels stay bars', () => {
    const { container } = inScope(<TabNavigation tabs={[{ id: 'a', label: 'Overview' }]} activeTab="a" staticLabels />);
    expect(container.textContent).toContain('Overview');
    expect(container.querySelector('[inert]')).not.toBeNull();
  });

  it("a part given its data in a scope draws it (the page's own), and its skeleton only when the data is read", () => {
    const { container } = inScope(
      <PlatformBadge platform={{ id: '1', name: 'openframe', display_name: 'OpenFrame' }} />,
    );
    expect(container.textContent).toContain('OpenFrame');
    const view = inScope(<PlatformBadge platform={null} />);
    expect(view.container.querySelector(SURFACE)).not.toBeNull();
  });

  it('a benefit whose words are read draws its icon and a bar exactly the copy wide (the words unseen)', () => {
    const { container } = render(
      <BenefitList items={[{ icon: <svg data-testid="mark" />, label: 'Trusted by {count} MSPs', loading: true }]} />,
    );
    expect(screen.getByTestId('mark')).toBeTruthy();
    const bar = container.querySelector(SURFACE);
    expect(bar?.className).toContain('text-transparent');
    expect(bar?.textContent).toBe('Trusted by {count} MSPs');
  });
});
