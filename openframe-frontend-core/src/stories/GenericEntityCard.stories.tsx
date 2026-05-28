import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { GenericEntityCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import {
  financialKpiItem,
  capTableItem,
  profitLossItem,
  balanceSheetItem,
  cashFlowItem,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof GenericEntityCard> = {
  title: 'Chat/EntityCards/GenericEntityCard',
  component: GenericEntityCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Fallback card for doc types that don\'t need a bespoke renderer. Covers `financial_kpi`, `cap_table`, `profit_loss`, `balance_sheet`, `cash_flow`. The flexible `facts` array drives the key-value strip at the bottom; `badge` drives the colored chip on the right.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const FinancialKpi: Story = {
  args: {
    item: financialKpiItem,
    anchorProps: makeAnchorProps(financialKpiItem.url ?? '#'),
  },
}

export const CapTable: Story = {
  args: {
    item: capTableItem,
    anchorProps: makeAnchorProps(capTableItem.url ?? '#'),
  },
}

export const ProfitLoss: Story = {
  args: {
    item: profitLossItem,
    anchorProps: makeAnchorProps(profitLossItem.url ?? '#'),
  },
}

export const BalanceSheet: Story = {
  args: {
    item: balanceSheetItem,
    anchorProps: makeAnchorProps(balanceSheetItem.url ?? '#'),
  },
}

export const CashFlow: Story = {
  args: {
    item: cashFlowItem,
    anchorProps: makeAnchorProps(cashFlowItem.url ?? '#'),
  },
}
