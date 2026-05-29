import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { GitHubActivityCard } from '../components/chat/entity-cards'
import {
  ChatColumnDecorator,
  makeAnchorProps,
} from './__fixtures__/chat-card-decorator'
import {
  githubCommitItem,
  githubPullRequestItem,
  githubPrReviewItem,
} from './__fixtures__/chat-cards'

const meta: Meta<typeof GitHubActivityCard> = {
  title: 'Chat/EntityCards/GitHubActivityCard',
  component: GitHubActivityCard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Inline card rendered in chat for the `github_commit`, `github_pull_request` and `github_pr_review` doc types (plus their `_public` variants). Pure presentation — caller passes resolved `anchorProps`. The card derives `owner/repo` from the URL when `item.repo` is omitted, shortens long commit SHAs and parses `[review:STATE]` markers from review titles to drive the state badge color.',
      },
    },
  },
  decorators: [(Story) => <ChatColumnDecorator><Story /></ChatColumnDecorator>],
}

export default meta
type Story = StoryObj<typeof meta>

export const Commit: Story = {
  args: {
    item: githubCommitItem,
    variant: 'compact',
    anchorProps: makeAnchorProps(githubCommitItem.url ?? '#'),
  },
}

export const PullRequest: Story = {
  args: {
    item: githubPullRequestItem,
    variant: 'compact',
    anchorProps: makeAnchorProps(githubPullRequestItem.url ?? '#'),
  },
}

export const PullRequestReview: Story = {
  args: {
    item: githubPrReviewItem,
    variant: 'compact',
    anchorProps: makeAnchorProps(githubPrReviewItem.url ?? '#'),
  },
}

export const RowVariant: Story = {
  args: {
    item: githubPullRequestItem,
    variant: 'row',
    anchorProps: makeAnchorProps(githubPullRequestItem.url ?? '#'),
  },
}
