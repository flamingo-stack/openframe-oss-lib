import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiAssistantInfo } from '../ai-assistant-info';
import { ChatAppearanceContext } from '../chat-appearance-context';
import { ChatInput } from '../chat-input';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ErrorMessageDisplay } from '../error-message-display';

describe('chat appearance', () => {
  it('classic keeps the colon after the author name', () => {
    render(<ChatMessageEnhanced role="assistant" assistantType="fae" name="Fae" content="Hi" />);
    expect(screen.getByText('Fae:')).toBeTruthy();
  });

  it('v2 drops the colon after the author name', () => {
    render(<ChatMessageEnhanced role="assistant" assistantType="fae" name="Fae" content="Hi" appearance="v2" />);
    expect(screen.getByText('Fae')).toBeTruthy();
    expect(screen.queryByText('Fae:')).toBeNull();
  });

  it('a row inherits v2 from the thread context', () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced role="user" name="John Smith" content="Hi" />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByText('John Smith')).toBeTruthy();
  });

  it('v2 blocks sit on the page surface', () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ErrorMessageDisplay data-testid="error" title="AI response error" details="Something went wrong." />
        <AiAssistantInfo data-testid="info" title="Handed Off to a Technician" />
      </ChatAppearanceContext.Provider>,
    );
    const error = screen.getByTestId('error');
    const info = screen.getByTestId('info');
    expect(error.className).toContain('bg-ods-bg');
    expect(error.className).not.toContain('mb-');
    expect(info.className).toContain('bg-ods-bg');
    expect(info.className).toContain('items-center');
  });

  it('hand-off bar names the team and shows their faces', () => {
    render(
      <ChatInput
        awaitingResponse
        appearance="v2"
        awaitingTeam={[
          { key: '1', name: 'Roman Smith' },
          { key: '2', name: 'Ada Lin' },
        ]}
      />,
    );
    expect(screen.getByText('Handed off to your technical support team')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Technicians: Roman Smith, Ada Lin' })).toBeTruthy();
  });
});
