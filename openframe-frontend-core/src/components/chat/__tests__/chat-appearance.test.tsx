import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiAssistantInfo } from '../ai-assistant-info';
import { ChatAppearanceContext } from '../chat-appearance-context';
import { ChatInput } from '../chat-input';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ErrorMessageDisplay } from '../error-message-display';

describe('chat appearance', () => {
  it('an assistant turn is plain text under the agent mark, with no written name', () => {
    render(<ChatMessageEnhanced role="assistant" assistantType="fae" name="Fae" content="Hi" />);
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Fae' })).toBeTruthy();
    expect(screen.queryByText('Fae')).toBeNull();
    expect(screen.queryByText('Fae:')).toBeNull();
  });

  it('v2 draws the same, with no written name', () => {
    render(<ChatMessageEnhanced role="assistant" assistantType="fae" name="Fae" content="Hi" appearance="v2" />);
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.queryByText('Fae')).toBeNull();
  });

  it('a user turn is a bubble under their face, with no written name, in a v2 thread too', () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced role="user" name="John Smith" content="Hi" />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(screen.getByTitle('John Smith')).toBeTruthy();
    expect(screen.queryByText('John Smith')).toBeNull();
  });

  it('Mingo v2 writes every author: face, name and time in a row', () => {
    const at = new Date();
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced role="assistant" assistantType="mingo" name="Mingo" content="On it" timestamp={at} />
      </ChatAppearanceContext.Provider>,
    );
    const name = screen.getByText('Mingo');
    expect(name.className).toContain('text-ods-flamingo-cyan');
    expect(name.className).toContain('text-h6');
    expect(screen.getByRole('img', { name: 'Mingo' })).toBeTruthy();
    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeTruthy();
  });

  it("Mingo v2 draws the user's turn like the agent's: named, on the left, no bubble", () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced role="user" assistantType="mingo" name="Roman Smith" content="Hi" />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByText('Roman Smith').className).toContain('text-ods-open-yellow');
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(document.body).not.toContainHTML('bg-ods-bg-active');
    expect(document.body).not.toContainHTML('justify-end');
  });

  it('a classic Mingo thread keeps the bubble and no written name', () => {
    render(<ChatMessageEnhanced role="user" assistantType="mingo" name="Roman Smith" content="Hi" />);
    expect(screen.queryByText('Roman Smith')).toBeNull();
    expect(screen.getByText('Hi')).toBeTruthy();
    expect(document.body).toContainHTML('bg-ods-bg-active');
  });

  it('a turn can hide its face', () => {
    render(<ChatMessageEnhanced role="assistant" assistantType="fae" name="Fae" content="Hi" showAvatar={false} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a technician in the thread keeps a name caption', () => {
    render(<ChatMessageEnhanced role="assistant" authorType="admin" name="Roman Smith" content="On it" />);
    expect(screen.getByText('Roman Smith')).toBeTruthy();
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

  it('v2 turns a technician joining into a receipt card', () => {
    render(
      <ChatMessageEnhanced
        role="user"
        authorType="system"
        name="Roman Smith joined the chat"
        content=""
        appearance="v2"
      />,
    );
    expect(screen.getByText('Technician Joined')).toBeTruthy();
    expect(screen.getByText("You're now chatting with Roman Smith.")).toBeTruthy();
  });

  it('classic keeps the system line as an author row', () => {
    render(<ChatMessageEnhanced role="user" authorType="system" name="Roman Smith joined the chat" content="" />);
    expect(screen.getByText('Roman Smith joined the chat')).toBeTruthy();
    expect(screen.queryByText('Technician Joined')).toBeNull();
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
