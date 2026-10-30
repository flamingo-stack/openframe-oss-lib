/**
 * The AI guardrail's review of an RMM command: it must say WHICH path set the
 * approval level (policy, fallback, soft or hard rule), on the approval card and
 * on the tool chip, and survive the NATS decoder that drops unknown fields.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { CommandReviewBlock } from '../command-review-block';
import { ToolExecutionDisplay } from '../tool-execution-display';
import type { CommandReviewData, ToolExecutionData } from '../types/message.types';
import { normalizeCommandReview } from '../utils/command-review';

const SOFT_DENY: CommandReviewData = {
  decision: 'SOFT_DENY',
  approvalLevel: 'ASK_TECHNICIAN',
  policyLevel: 'ALLOW',
  operationCodes: ['MANAGE_ANTIVIRUS'],
  matchedRules: [{ code: 'SECURITY_WEAKEN', label: 'Security Weaken' }],
  reason: 'Turns off real-time protection.',
};

describe('CommandReviewBlock', () => {
  it('names a soft deny, the level it raised to and the policy level under it', () => {
    render(<CommandReviewBlock review={SOFT_DENY} />);

    expect(screen.getByText('Soft deny')).toBeTruthy();
    expect(screen.getByText('Ask technician')).toBeTruthy();
    expect(screen.getByText('(policy: Allowed)')).toBeTruthy();
    expect(screen.getByText('Security Weaken')).toBeTruthy();
    expect(screen.getByText('Turns off real-time protection.')).toBeTruthy();
    expect(screen.getByText('MANAGE_ANTIVIRUS')).toBeTruthy();
  });

  it('says the operation is not in the policy on a fallback, without a policy hint', () => {
    render(
      <CommandReviewBlock
        review={{ decision: 'FALLBACK', approvalLevel: 'ASK_TECHNICIAN', policyLevel: 'ASK_TECHNICIAN' }}
      />,
    );

    expect(screen.getByText('Not in policy')).toBeTruthy();
    expect(screen.queryByText(/policy:/)).toBeNull();
  });

  it('names a hard deny', () => {
    render(<CommandReviewBlock review={{ decision: 'HARD_DENY', approvalLevel: 'DENY', policyLevel: 'ALLOW' }} />);

    expect(screen.getByText('Hard deny')).toBeTruthy();
    expect(screen.getByText('Denied')).toBeTruthy();
  });
});

describe('command review on the wire', () => {
  it('drops malformed rules and blank codes', () => {
    const review = normalizeCommandReview({
      decision: 'POLICY',
      operationCodes: ['LIST_PROCESS', '', 7],
      matchedRules: [{ code: 'X', label: 'Y' }, 'junk', {}],
    });

    expect(review).toEqual({
      decision: 'POLICY',
      approvalLevel: undefined,
      policyLevel: undefined,
      operationCodes: ['LIST_PROCESS'],
      matchedRules: [{ code: 'X', label: 'Y' }],
      reason: undefined,
    });
  });

  it('keeps the review on an EXECUTING_TOOL chunk', () => {
    const event = decodeNatsChunk({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'OPENFRAME_RMM',
      toolFunction: 'runCommand',
      commandReview: SOFT_DENY,
    });

    expect(event).toMatchObject({ type: 'tool-execution', data: { commandReview: SOFT_DENY } });
  });

  it('keeps the review on an approval request tool call', () => {
    const event = decodeNatsChunk({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req-1',
      approvalType: 'ADMIN',
      toolCalls: [{ toolExecutionRequestId: 'call-1', toolName: 'runCommand', commandReview: SOFT_DENY }],
    });

    expect(JSON.stringify(event)).toContain('"decision":"SOFT_DENY"');
  });
});

describe('command review on the tool chip', () => {
  const reviewedRun: ToolExecutionData = {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'OPENFRAME_RMM',
    toolFunction: 'runCommand',
    toolTitle: 'ps aux',
    success: true,
    commandReview: { decision: 'POLICY', approvalLevel: 'ALLOW', policyLevel: 'ALLOW' },
  };

  it('shows the review in the admin chip body', () => {
    render(<ToolExecutionDisplay message={reviewedRun} assistantType="mingo" />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('AI review')).toBeTruthy();
    expect(screen.getByText('Allowed')).toBeTruthy();
  });

  it('never shows the review to the end client', () => {
    render(<ToolExecutionDisplay message={reviewedRun} assistantType="fae" variant="client" />);

    expect(screen.queryByText('AI review')).toBeNull();
  });
});
