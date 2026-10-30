/**
 * `ToolExecutionDisplay` — the running/ran-a-tool row.
 *
 * These pin WHO gets an expander. A remote (MCP) read-only tool publishes no
 * parameters and no result on purpose, so a chevron on that row opens an empty
 * box — the failure this file exists to prevent. Local tools, and anything that
 * actually has detail, must keep theirs.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { chatProgressFrame } from '../../../chat-protocol/progress';
import { ToolExecutionDisplay } from '../tool-execution-display';
import type { ToolExecutionData } from '../types/message.types';

/**
 * The `EXECUTING_TOOL` shape the backend sends for a remote read-only tool: a
 * human title, and nothing else to show.
 *
 * `integratedToolType: ''` is what a remote tool looks like after decoding —
 * the wire sends `null` and the decoder normalizes it (`strOr`). That empty
 * value is the marker "not one of our integrations".
 */
const remoteRead: ToolExecutionData = {
  type: 'EXECUTING_TOOL',
  integratedToolType: '',
  toolFunction: 'search_docs',
  toolTitle: 'Searching OpenFrame resources',
  toolExecutionRequestId: 'execution-123',
};

/** The row is a `<button>` only when it can be expanded. */
const expander = () => screen.queryByRole('button');

describe('ToolExecutionDisplay', () => {
  it('renders a remote read-only tool as a static row', () => {
    render(<ToolExecutionDisplay message={remoteRead} assistantType="mingo" />);

    expect(screen.getByText('Searching OpenFrame resources')).toBeTruthy();
    expect(expander()).toBeNull();
  });

  it('keeps the expander when a remote tool does have a result', () => {
    render(
      <ToolExecutionDisplay
        message={{ ...remoteRead, type: 'EXECUTED_TOOL', success: true, result: '{"tickets":[]}' }}
        assistantType="mingo"
      />,
    );
    expect(expander()).toBeTruthy();
  });

  it('keeps the expander when a remote tool does have arguments', () => {
    render(<ToolExecutionDisplay message={{ ...remoteRead, parameters: { query: 'agent' } }} assistantType="mingo" />);
    expect(expander()).toBeTruthy();
  });

  it('keeps the expander for a local tool, whose empty body still shows progress', () => {
    // `integratedToolType` is what marks a tool as one of ours; those rows show
    // a live "Result:" placeholder while executing, so the body is not empty.
    render(<ToolExecutionDisplay message={{ ...remoteRead, integratedToolType: 'FLEET' }} assistantType="mingo" />);
    expect(expander()).toBeTruthy();
  });

  it("draws a hub turn's closed stage as the one-line row Mingo's tool rows use, not a card", () => {
    const event = decodeNatsChunk(chatProgressFrame({ stage: 'searching', count: 16 }, 'done', 't1'));
    if (event?.type !== 'tool-execution') throw new Error('not a tool-execution event');
    render(<ToolExecutionDisplay message={event.data} assistantType="mingo" />);
    expect(screen.getByText('Searching 16 sources')).toBeTruthy();
    // The card layout writes its state as a "Done" line; the one-line row shows only the check mark.
    expect(screen.queryByText('Done')).toBeNull();
    expect(expander()).toBeNull();
  });

  it('drops the expander once a local run ends with no arguments and no result', () => {
    // Its "Result:" placeholder is gone with the run, so nothing is left behind the chevron.
    render(
      <ToolExecutionDisplay
        message={{ ...remoteRead, integratedToolType: 'FLEET', type: 'EXECUTED_TOOL', success: true }}
        assistantType="mingo"
      />,
    );
    expect(screen.getByText('Searching OpenFrame resources')).toBeTruthy();
    expect(expander()).toBeNull();
  });

  it('keeps the old behaviour when the backend sent no title', () => {
    // Collapsing to a static row here would render a blank line.
    render(<ToolExecutionDisplay message={{ ...remoteRead, toolTitle: undefined }} assistantType="mingo" />);
    expect(expander()).toBeTruthy();
  });

  it("squares the expander's corners: the frame clips them, and the open body meets it flat", () => {
    render(
      <ToolExecutionDisplay
        message={{ ...remoteRead, type: 'EXECUTED_TOOL', success: true, result: '{"tickets":[]}' }}
        assistantType="mingo"
      />,
    );
    expect(expander()).toHaveClass('rounded-none');
    expect(expander()).not.toHaveClass('rounded-md');
  });
});
