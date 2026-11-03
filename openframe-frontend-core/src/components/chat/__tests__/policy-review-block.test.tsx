/**
 * The security policy's review of a tool call: it must say WHICH path set the
 * approval level (policy, fallback, soft or hard rule), on the approval card and
 * on the tool chip, and survive the NATS decoder that drops unknown fields.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { PolicyReviewBlock } from '../policy-review-block';
import { ToolExecutionDisplay } from '../tool-execution-display';
import type { PolicyReviewData, ToolExecutionData } from '../types/message.types';
import { normalizePolicyReview } from '../utils/policy-review';

const SOFT_DENY: PolicyReviewData = {
  source: 'CLASSIFIER',
  decision: 'SOFT_DENY',
  approvalLevel: 'ASK_TECHNICIAN',
  policyLevel: 'ALLOW',
  operationCodes: ['MANAGE_ANTIVIRUS'],
  matchedRules: [{ code: 'SECURITY_WEAKEN', label: 'Security Weaken', type: 'SOFT_DENY' }],
  reason: 'Turns off real-time protection.',
};

describe('PolicyReviewBlock', () => {
  it('names a soft deny, the level it raised to and the policy level under it', () => {
    render(<PolicyReviewBlock review={SOFT_DENY} />);

    expect(screen.getByText('Soft deny')).toBeTruthy();
    expect(screen.getByText('Ask technician')).toBeTruthy();
    expect(screen.getByText('(policy: Allowed)')).toBeTruthy();
    expect(screen.getByText('Security Weaken')).toBeTruthy();
    expect(screen.getByText('Turns off real-time protection.')).toBeTruthy();
    expect(screen.getByText('MANAGE_ANTIVIRUS')).toBeTruthy();
  });

  it('says the operation is not in the policy on a fallback, without a policy hint', () => {
    render(
      <PolicyReviewBlock
        review={{ decision: 'FALLBACK', approvalLevel: 'ASK_TECHNICIAN', policyLevel: 'ASK_TECHNICIAN' }}
      />,
    );

    expect(screen.getByText('Not in policy')).toBeTruthy();
    expect(screen.queryByText(/policy:/)).toBeNull();
  });

  it('titles a classifier review as the AI review and any other source as the policy review', () => {
    const { rerender } = render(<PolicyReviewBlock review={{ source: 'CLASSIFIER', decision: 'POLICY' }} />);
    expect(screen.getByText('AI review')).toBeTruthy();

    rerender(<PolicyReviewBlock review={{ source: 'REGEX', decision: 'POLICY' }} />);
    expect(screen.getByText('Policy review')).toBeTruthy();
    expect(screen.queryByText('AI review')).toBeNull();
  });

  it('names a hard deny', () => {
    render(<PolicyReviewBlock review={{ decision: 'HARD_DENY', approvalLevel: 'DENY', policyLevel: 'ALLOW' }} />);

    expect(screen.getByText('Hard deny')).toBeTruthy();
    expect(screen.getByText('Denied')).toBeTruthy();
  });
});

describe('policy review on the wire', () => {
  it('drops malformed rules and blank codes, and keeps a rule type only when there is one', () => {
    const review = normalizePolicyReview({
      source: 'CLASSIFIER',
      decision: 'POLICY',
      operationCodes: ['LIST_PROCESS', '', 7],
      matchedRules: [{ code: 'X', label: 'Y', type: 'HARD_DENY' }, { code: 'Z', label: 'W', type: 3 }, 'junk', {}],
    });

    expect(review).toEqual({
      source: 'CLASSIFIER',
      decision: 'POLICY',
      approvalLevel: undefined,
      policyLevel: undefined,
      operationCodes: ['LIST_PROCESS'],
      matchedRules: [
        { code: 'X', label: 'Y', type: 'HARD_DENY' },
        { code: 'Z', label: 'W' },
      ],
      reason: undefined,
    });
  });

  it('keeps the review on an EXECUTING_TOOL chunk', () => {
    const event = decodeNatsChunk({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'OPENFRAME_RMM',
      toolFunction: 'runCommand',
      policyReview: SOFT_DENY,
    });

    expect(event).toMatchObject({ type: 'tool-execution', data: { policyReview: SOFT_DENY } });
  });

  it('keeps the review on an approval request tool call', () => {
    const event = decodeNatsChunk({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req-1',
      approvalType: 'ADMIN',
      toolCalls: [{ toolExecutionRequestId: 'call-1', toolName: 'runCommand', policyReview: SOFT_DENY }],
    });

    expect(JSON.stringify(event)).toContain('"decision":"SOFT_DENY"');
  });
});

describe('policy review on the tool chip', () => {
  const reviewedRun: ToolExecutionData = {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'OPENFRAME_RMM',
    toolFunction: 'runCommand',
    toolTitle: 'ps aux',
    success: true,
    policyReview: { source: 'CLASSIFIER', decision: 'POLICY', approvalLevel: 'ALLOW', policyLevel: 'ALLOW' },
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
