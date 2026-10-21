import { render, screen } from '@testing-library/react';
/**
 * The loading contract: in a `LoadingScope` a component draws its own `<Name>Skeleton` — its static copy for real,
 * every read part a skeleton shape, never a read word and never nothing.
 */
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CategoriesCart } from '../../categories-cart';
import { ChatMessageList } from '../../chat/chat-message-list';
import { CHAT_MESSAGE_LIST_SKELETON_MESSAGES } from '../../chat/chat-message-skeleton';
import { ChatTurn } from '../../chat/chat-turn';
import { EntityAuthorCard } from '../../chat/entity-cards/entity-author-card';
import { SsoJoinForm } from '../../features/auth/sso-join-form';
import { DeviceSelector } from '../../features/devices/device-selector/device-selector';
import { DevicesGrid } from '../../features/devices/devices-grid';
import { DevicesList } from '../../features/devices/devices-list';
import { LogsTableView } from '../../features/logs/logs-table-view';
import { PlatformBadge } from '../../features/platform-badge';
import {
  POLICY_CONFIGURATION_PANEL_SKELETON_CATEGORIES,
  PolicyConfigurationPanel,
} from '../../features/policy-configuration-panel';
import { PushButtonSelector } from '../../features/push-button-selector';
import {
  TICKET_STATUS_CONFIG_LIST_SKELETON_ROWS,
  TicketStatusConfigList,
} from '../../features/ticket-status-config-list/ticket-status-config-list';
import { Video } from '../../features/video';
import { VideoBitesStrip } from '../../features/video-bites-strip';
import { LoadingFallback } from '../../loading/loading-fallback';
import { MetricValue } from '../../metric-value';
import { MSPDisplay } from '../../msp-display';
import { ToolBadge } from '../../platform/ToolBadge';
import { UserDisplay } from '../../user-display';
import { VendorIcon } from '../../vendor-icon';
import { AvatarStack } from '../avatar-stack';
import { BenefitList } from '../benefit-list';
import { CheckboxBlock } from '../checkbox-block';
import { CheckboxWithDescription } from '../checkbox-with-description';
import { DashboardInfoCard } from '../dashboard-info-card';
import { DeviceCard } from '../device-card';
import { InfoCard, InfoCardSkeleton } from '../info-card';
import { InfoSection } from '../info-section';
import { LeaderRow } from '../leader-row';
import { LoadingScope, LoadingWhen, useLoadingScope } from '../loading-scope';
import { RADIO_GROUP_BLOCK_SKELETON_OPTIONS, RadioGroupBlock } from '../radio-group';
import { ServiceCard } from '../service-card';
import { StatusBadge } from '../status-badge';
import { SuperUserBannerView } from '../super-user-banner-view';
import { TabNavigation } from '../tab-navigation';
import { Tabs, TabsList, TabsTrigger } from '../tabs';
import { TicketStatusConfigRow } from '../ticket-status-config-row';

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

  it('LoadingWhen switches its children without remounting them, and never cancels an outer scope', () => {
    const mounts: number[] = [];
    function Counted() {
      const [id] = useState(() => mounts.push(mounts.length) && mounts.length);
      return (
        <span data-testid="flag" data-id={id}>
          {String(useLoadingScope())}
        </span>
      );
    }
    const view = render(
      <LoadingWhen loading>
        <Counted />
      </LoadingWhen>,
    );
    expect(screen.getByTestId('flag').textContent).toBe('true');
    view.rerender(
      <LoadingWhen loading={false}>
        <Counted />
      </LoadingWhen>,
    );
    expect(screen.getByTestId('flag').textContent).toBe('false');
    expect(mounts).toHaveLength(1);
    view.unmount();
    render(
      <LoadingScope>
        <LoadingWhen loading={false}>
          <ScopeFlag />
        </LoadingWhen>
      </LoadingScope>,
    );
    expect(screen.getByTestId('flag').textContent).toBe('true');
  });

  it('LoadingFallback draws its child in a scope and announces it once', () => {
    render(
      <LoadingFallback label="Loading devices">
        <ScopeFlag />
      </LoadingFallback>,
    );
    expect(screen.getByTestId('flag').textContent).toBe('true');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Loading devices');
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
    [
      'InfoSection',
      <InfoSection
        key="a"
        title="Ticket Details"
        rows={[
          { id: 'a', label: 'Assignee', value: { text: READ } },
          { id: 'b', label: 'Status', value: { type: 'custom', content: READ } },
        ]}
      />,
      ['Ticket Details', 'Assignee', 'Status'],
    ],
    [
      'ChatMessageList',
      <ChatMessageList key="a" messages={[{ id: '1', role: 'user', content: READ, timestamp: new Date() }]} />,
      [],
    ],
    [
      'TicketStatusConfigRow',
      <TicketStatusConfigRow
        key="a"
        variant="custom"
        statusKey="x"
        name={READ}
        color="#ff0000"
        onColorChange={() => {}}
      />,
      ['Status Name', 'Color'],
    ],
    [
      'TicketStatusConfigList',
      <TicketStatusConfigList key="a" items={[]} onReorder={() => {}} renderRow={() => READ} />,
      ['Status Name'],
    ],
    [
      'CheckboxBlock',
      <CheckboxBlock key="a" label="Notify me" description="By email" checked />,
      ['Notify me', 'By email'],
    ],
    ['SuperUserBannerView', <SuperUserBannerView key="a" tenantName={READ} />, ['Super user access']],
    [
      'SsoJoinForm',
      <SsoJoinForm
        key="a"
        name={READ}
        email={READ}
        organizationName={READ}
        roles={[READ]}
        agreedToTerms={false}
        onAgreedToTermsChange={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
      ['One Last Step', "Confirm the account you're joining with.", 'Create Account', 'Back to Login'],
    ],
    [
      'ServiceCard',
      <ServiceCard
        key="a"
        title="Database"
        rows={[
          { label: 'Host', value: READ },
          { label: 'Password', value: READ, isSecret: true },
        ]}
      />,
      ['Database', 'Host', 'Password'],
    ],
    [
      'PolicyConfigurationPanel',
      <PolicyConfigurationPanel
        key="a"
        categories={[{ id: 'c', name: 'File system', policies: [{ id: 'p', name: READ } as never] }]}
        editMode={false}
        onPolicyPermissionChange={() => {}}
        onCategoryPermissionChange={() => {}}
      />,
      ['File system'],
    ],
    [
      'RadioGroupBlock',
      <RadioGroupBlock
        key="a"
        value="b"
        options={[
          { value: 'a', label: 'All devices' },
          { value: 'b', label: 'Selected devices', description: 'Pick them one by one' },
        ]}
      />,
      ['All devices', 'Selected devices', 'Pick them one by one'],
    ],
    [
      'CheckboxWithDescription',
      <CheckboxWithDescription
        key="a"
        id="x"
        checked
        onCheckedChange={() => {}}
        title="Auto update"
        description="Install new versions"
      />,
      ['Auto update', 'Install new versions'],
    ],
    ['DeviceCard', <DeviceCard key="a" device={{ name: READ, organization: READ }} />, []],
    [
      'DashboardInfoCard',
      <DashboardInfoCard key="a" title="" icon={<span>{READ}</span>} iconLoading value={READ} />,
      [],
    ],
    [
      'InfoCard',
      <InfoCard
        key="a"
        data={{ items: [] }}
        skeleton={{ title: 'Hardware', subtitle: 'Last scan', rows: ['CPU', null, 'Memory'] }}
      />,
      ['Hardware', 'Last scan', 'CPU', 'Memory'],
    ],
    ['DevicesList', <DevicesList key="a" devices={[]} />, []],
    ['DevicesGrid', <DevicesGrid key="a" devices={[]} isLoading={false} />, []],
    ['LogsTableView', <LogsTableView key="a" logs={[]} filters={{}} onFilterChange={() => {}} />, ['Log ID']],
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

  it('a benefit whose value is read draws its icon, its words real and a bar a typical value wide where the value goes', () => {
    const { container } = render(
      <BenefitList
        items={[{ icon: <svg data-testid="mark" />, label: 'Trusted by {count} MSPs', loading: true, typical: '000' }]}
      />,
    );
    expect(screen.getByTestId('mark')).toBeTruthy();
    const bar = container.querySelector(SURFACE);
    expect(bar?.className).toContain('text-transparent');
    expect(bar?.textContent).toBe('000');
    expect(container.textContent).toBe('Trusted by 000 MSPs');
  });

  it('a list in a scope draws its declared typical count, each item a `data-loading-item`', () => {
    const { container: chatView } = inScope(<ChatMessageList messages={[]} />);
    expect(chatView.querySelectorAll('[data-loading-item]')).toHaveLength(CHAT_MESSAGE_LIST_SKELETON_MESSAGES);
    const { container: statusesView } = inScope(
      <TicketStatusConfigList items={[]} onReorder={() => {}} renderRow={() => null} />,
    );
    expect(statusesView.querySelectorAll('[data-loading-item]')).toHaveLength(TICKET_STATUS_CONFIG_LIST_SKELETON_ROWS);
  });

  it('lists whose items are read draw their declared typical count, and the host may state its own', () => {
    const panel = (count?: number) =>
      inScope(
        <PolicyConfigurationPanel
          categories={[]}
          editMode={false}
          skeletonCount={count}
          onPolicyPermissionChange={() => {}}
          onCategoryPermissionChange={() => {}}
        />,
      ).container.querySelectorAll('[data-loading-item]');
    expect(panel()).toHaveLength(POLICY_CONFIGURATION_PANEL_SKELETON_CATEGORIES);
    expect(panel(2)).toHaveLength(2);
    const { container: radios } = inScope(<RadioGroupBlock options={[]} />);
    expect(radios.querySelectorAll('[data-loading-item]')).toHaveLength(RADIO_GROUP_BLOCK_SKELETON_OPTIONS);
    const { container: radiosNamed } = inScope(<RadioGroupBlock options={[{ value: 'a', label: 'Daily' }]} />);
    expect(radiosNamed.querySelectorAll('[data-loading-item]')).toHaveLength(1);
    expect(radiosNamed.querySelector('[role="radio"]')).toBeNull();
  });

  it('the loading prop switches each component without a scope', () => {
    const { container: card } = render(<ServiceCard title="API" rows={[{ label: 'Key', value: READ }]} loading />);
    expect(card.querySelector(SURFACE)).not.toBeNull();
    expect(card.textContent).not.toContain(READ);
    const { container: device } = render(<DeviceCard device={{ name: READ }} loading data-loading-item="" />);
    expect(device.querySelector('[data-loading-item]')).not.toBeNull();
    expect(device.textContent).not.toContain(READ);
    const { container: sso } = render(
      <SsoJoinForm
        name={READ}
        organizationName={READ}
        agreedToTerms={false}
        onAgreedToTermsChange={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        identityLoading
      />,
    );
    expect(sso.textContent).not.toContain(READ);
    expect(sso.textContent).toContain('Create Account');
    const { container: info } = render(<InfoCard data={{ items: [{ label: 'OS', value: READ }] }} loading />);
    expect(info.textContent).not.toContain(READ);
  });

  it('a skeleton InfoCard draws unlabelled rows as value bars only', () => {
    const { container } = render(<InfoCardSkeleton title={false} rows={2} unlabelledRows />);
    expect(container.querySelectorAll(SURFACE)).toHaveLength(2);
  });

  it('a DashboardInfoCard whose title is read draws a title bar, its icon slot a skeleton', () => {
    const { container } = inScope(
      <DashboardInfoCard title={READ} titleLoading icon={<span>{READ}</span>} iconLoading value={READ} />,
    );
    expect(container.textContent).not.toContain(READ);
  });

  it('the device selector draws the rows the host states while loading', () => {
    const { container } = render(
      <DeviceSelector devices={[]} loading skeletonRows={5} showSelectionModeRadio={false} />,
    );
    expect(container.querySelectorAll('[data-loading-item]')).toHaveLength(5);
  });

  it('an empty list in a scope never draws its empty state', () => {
    const { container: logsView } = inScope(<LogsTableView logs={[]} filters={{}} onFilterChange={() => {}} />);
    expect(logsView.textContent).not.toContain('No logs yet');
    const { container: devicesView } = inScope(<DevicesList devices={[]} emptyState={{ title: 'No devices yet' }} />);
    expect(devicesView.textContent).not.toContain('No devices yet');
  });

  it('the logs table draws one skeleton row per log of a page when the host states its page size', () => {
    const { container } = inScope(<LogsTableView logs={[]} filters={{}} onFilterChange={() => {}} pageSize={7} />);
    expect(container.querySelectorAll('[data-loading-item]')).toHaveLength(7);
  });

  it('the loaded forms carry the same item markers: status rows and chat messages', () => {
    const { container: statusesView } = render(
      <TicketStatusConfigList
        items={[{ id: 'a' }, { id: 'b' }]}
        onReorder={() => {}}
        renderRow={item => <span>{item.id}</span>}
      />,
    );
    expect(statusesView.querySelectorAll('[data-loading-item]')).toHaveLength(2);
    const { container: chatView } = render(
      <ChatMessageList
        messages={[
          { id: '1', role: 'user', content: 'Hi', timestamp: new Date() },
          { id: '2', role: 'assistant', content: 'Hello', timestamp: new Date() },
        ]}
      />,
    );
    expect(chatView.querySelectorAll('[data-loading-item]')).toHaveLength(2);
  });
});

describe('loading gaps the frontend asked for', () => {
  it('ServiceCard draws a subtitle bar for a subtitle still being read', () => {
    const { container } = render(<ServiceCard loading title="Fleet" subtitle="" rows={[]} />);
    expect(container.textContent).toContain('Fleet');
    expect(container.querySelectorAll(SURFACE).length).toBeGreaterThan(0);
  });

  it('DeviceCard keeps the details button box while loading', () => {
    const { container } = render(
      <DeviceCard
        loading
        device={{ name: READ }}
        actions={{ detailsButton: { visible: true, component: <span /> } }}
        detailsButtonSkeletonClassName="size-12"
      />,
    );
    expect(container.querySelector('.size-12')).not.toBeNull();
    expect(container.textContent).not.toContain(READ);
  });

  it('LoadingFallback takes the region element and class (a contents box keeps a flex parent)', () => {
    const { container } = render(
      <LoadingFallback as="section" className="contents">
        <ScopeFlag />
      </LoadingFallback>,
    );
    expect(container.querySelector('section.contents')).not.toBeNull();
    expect(screen.getByTestId('flag').textContent).toBe('true');
  });
});
