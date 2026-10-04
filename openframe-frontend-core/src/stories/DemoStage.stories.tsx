import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AgentMark } from '../components/agent-mark';
import { ConversationCard } from '../components/features/conversation-card';
import { ToolBadge } from '../components/platform/ToolBadge';
import { AppWindowFrame } from '../components/ui/app-window-frame';
import { FeatureCardGrid } from '../components/ui/feature-card';
import { FeatureList } from '../components/ui/feature-list';
import { IncidentFeed, type IncidentFeedItem, type IncidentStatus } from '../components/ui/incident-feed';
import {
  PhoneApprovalActions,
  PhoneFrame,
  PhoneNotification,
  PhoneNotificationResult,
} from '../components/ui/phone-frame';
import { SnapCarousel } from '../components/ui/snap-carousel';
import { TabNavigation } from '../components/ui/tab-navigation';
import { useScenarioPlayer } from '../hooks/use-scenario-player';

const meta = {
  title: 'Features/DemoStage',
  parameters: {
    docs: {
      description: {
        component:
          "The primitives of a looping product demo: `useScenarioPlayer` (the clock), a timed `TabNavigation`, `FeatureList` with an active step, `AppWindowFrame`, `IncidentFeed`, `PhoneFrame` with one notification, plus `ConversationCard`, `SnapCarousel` and `ToolBadge` for the sections around it. All copy is the caller's.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUS_LABELS: Record<IncidentStatus, string> = {
  working: 'Fixing',
  fixed: 'Fixed on its own',
  waiting: 'Waiting for you',
  approved: 'Approved by you',
};

const STEPS = [
  { title: 'Mingo reads the logs', description: 'Patch, security and sign-in logs from every computer.' },
  { title: 'Fixes what your rules allow', description: 'Tested first, then rolled out.' },
  { title: 'Asks you for the rest', description: 'One tap on your phone.' },
];

function feedAt(step: number): IncidentFeedItem[] {
  const items: Array<IncidentFeedItem & { at: number }> = [
    {
      at: 1,
      id: 'update',
      source: 'Patch logs',
      title: 'Browser update failed on 38 computers',
      status: step >= 2 ? 'fixed' : 'working',
      detail: step >= 2 ? 'Tested on 2, then fixed all 38.' : 'Testing a fix on 2 computers first',
      time: '2:14 AM',
    },
    {
      at: 3,
      id: 'firewall',
      source: 'Security logs',
      title: 'Firewall turned off on 4 laptops',
      status: step >= 4 ? 'fixed' : 'working',
      detail: step >= 4 ? 'Turned back on. Your rule: fix on its own.' : 'Turning the firewall back on',
      time: '3:41 AM',
    },
    {
      at: 5,
      id: 'signin',
      source: 'Sign-in logs',
      title: 'Unusual sign-in for Sam Okafor, new country',
      status: step >= 7 ? 'approved' : 'waiting',
      detail:
        step >= 7 ? 'You approved on your phone. Account locked.' : 'Your rule for locking accounts: ask me first.',
      time: '5:08 AM',
    },
  ];
  return items.filter(item => step >= item.at);
}

function Stage() {
  const { scenario, step, go, setStep } = useScenarioPlayer({
    scenarioCount: 1,
    lastStep: 8,
    stepMs: 1700,
    holdMs: 4200,
  });
  const activeStep = step >= 5 ? 2 : step >= 2 ? 1 : 0;
  const waiting = step >= 5 && step < 7;
  return (
    <div className="flex flex-col gap-6 bg-ods-bg p-6">
      <TabNavigation
        tabs={[
          {
            id: 'logs',
            label: 'Mingo finds it in the logs',
            sublabel: 'Your desktop app',
            avatar: <AgentMark agent="mingo" className="h-6 w-6" />,
            progress: step / 8,
          },
        ]}
        activeTab={scenario === 0 ? 'logs' : ''}
        onTabChange={() => go(0)}
        progressTransitionMs={1700}
        stretchTabs
      />
      <div className="grid items-end gap-7 lg:grid-cols-[1fr_640px_236px]">
        <FeatureList variant="numbered" items={STEPS} activeIndex={activeStep} className="self-center" />
        <AppWindowFrame
          title="Mingo"
          className="h-[540px]"
          footer={<div className="px-5 py-3.5 text-ods-text-primary text-h6">{feedAt(step).length} found</div>}
        >
          <IncidentFeed
            items={feedAt(step)}
            statusLabels={STATUS_LABELS}
            emptyLabel="All quiet. Mingo is reading your logs."
          />
        </AppWindowFrame>
        <PhoneFrame dateLabel="Thursday, October 1" timeLabel="5:09" className="h-[540px]">
          {step >= 5 && (
            <PhoneNotification
              key="approval"
              appLabel="Mingo · Needs you"
              icon={<AgentMark agent="mingo" className="h-full w-full" />}
              title="Lock Sam's account?"
              body="New-country sign-in at 5:08 AM. Your rule: ask first."
            >
              {waiting ? (
                <PhoneApprovalActions
                  approveLabel="Approve"
                  declineLabel="Decline"
                  approvePressed={step >= 6}
                  interactive
                  onApprove={() => setStep(7)}
                />
              ) : (
                <PhoneNotificationResult label="Approved. Account locked." />
              )}
            </PhoneNotification>
          )}
        </PhoneFrame>
      </div>
    </div>
  );
}

export const LoopingStage: Story = { render: () => <Stage /> };

const ASKS = [
  {
    who: 'Maya Lopez',
    where: 'on her laptop',
    quote: "I can't connect to the printer.",
    done: 'Reinstalled the printer driver on her laptop',
    part: 'Nothing',
  },
  {
    who: 'Leo Martin',
    where: 'on his laptop',
    quote: 'Can I get Figma?',
    done: 'Paid app, so it asked you. Installed after your tap',
    part: 'One tap',
  },
  {
    who: 'You',
    where: 'IT admin',
    quote: 'Update Zoom on every Mac tonight.',
    done: 'Updated on 148 Macs at 11:40 PM',
    part: 'One request',
  },
];

export const RequestCards: Story = {
  render: () => (
    <div className="max-w-[390px] bg-ods-bg p-5">
      <SnapCarousel
        items={ASKS}
        label="Example requests"
        getKey={ask => ask.quote}
        renderItem={ask => (
          <ConversationCard
            requester={{
              avatar: <span className="block h-9 w-9 rounded-full bg-ods-border" />,
              name: ask.who,
              meta: ask.where,
            }}
            request={ask.quote}
            responder={{
              avatar: <AgentMark agent="fae" className="h-7 w-7 rounded-full" />,
              name: 'Fae',
              meta: 'this computer',
            }}
            outcome={ask.done}
            footerLabel="Your part"
            footerValue={ask.part}
            footerTone={ask.part === 'One tap' ? 'attention' : 'default'}
          />
        )}
      />
    </div>
  ),
};

export const CapabilityCards: Story = {
  render: () => (
    <div className="bg-ods-bg p-6">
      <FeatureCardGrid
        columns={3}
        items={[
          {
            title: 'Install anything, anywhere',
            content: (
              <p className="text-ods-text-secondary text-h4">Push any app or update to one computer or all of them.</p>
            ),
            footer: (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ods-text-secondary text-h5">Built on</span>
                <ToolBadge variant="chip" toolType="OPENFRAME_RMM" />
                <ToolBadge variant="chip" toolType="MESHCENTRAL" />
                <ToolBadge variant="chip" label="Homebrew" />
              </div>
            ),
          },
          {
            title: 'Know every device inside out',
            content: (
              <p className="text-ods-text-secondary text-h4">Every app, setting, user and serial number, live.</p>
            ),
            footer: (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ods-text-secondary text-h5">Built on</span>
                <ToolBadge variant="chip" toolType="FLEET_MDM" />
                <ToolBadge variant="chip" toolType="OSQUERY" />
              </div>
            ),
          },
        ]}
      />
    </div>
  ),
};
