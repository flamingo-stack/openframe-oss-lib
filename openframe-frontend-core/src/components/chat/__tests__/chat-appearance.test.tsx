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

  it("an admin's own turn in Mingo is a bubble under their face, with no written name", () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced role="user" authorType="admin" assistantType="mingo" name="Roman Smith" content="Hi" />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByTitle('Roman Smith')).toBeTruthy();
    expect(screen.queryByText('Roman Smith')).toBeNull();
    expect(document.body).toContainHTML('bg-ods-bg-active');
  });

  it("a technician's reply in the end user's thread is an incoming turn: named, no bubble, not on the right", () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced
          role="user"
          authorType="admin"
          selfAuthorType="user"
          assistantType="fae"
          name="Test Owner"
          content="On it"
          timestamp={new Date(2026, 9, 13, 12, 26)}
        />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByText('Test Owner')).toBeTruthy();
    expect(document.body).not.toContainHTML('bg-ods-bg-active');
    expect(document.body).not.toContainHTML('justify-end');
    expect(document.body).not.toContainHTML('justify-self-end');
    // A person, not the agent: initials, never the assistant's mark.
    expect(screen.queryByRole('img', { name: 'Test Owner' })).toBeNull();
    expect(screen.getByTitle('Test Owner')).toBeTruthy();
  });

  it("the end user's own turn stays a bubble on the right when the thread names its owner", () => {
    render(<ChatMessageEnhanced role="user" authorType="user" selfAuthorType="user" name="You" content="Hi" />);
    expect(document.body).toContainHTML('bg-ods-bg-active');
    expect(document.body).toContainHTML('justify-end');
    expect(screen.queryByText('You')).toBeNull();
  });

  it("a technician's own turn in a ticket thread is a bubble on the right that names its author", () => {
    render(
      <ChatAppearanceContext.Provider value="v2">
        <ChatMessageEnhanced
          role="user"
          authorType="admin"
          selfAuthorType="admin"
          nameEveryTurn
          name="Test Owner"
          content="On it"
          timestamp={new Date(2026, 9, 13, 12, 26)}
        />
      </ChatAppearanceContext.Provider>,
    );
    expect(screen.getByText('Test Owner')).toBeTruthy();
    expect(screen.getByTitle('Test Owner')).toBeTruthy();
    expect(document.body).toContainHTML('bg-ods-bg-active');
    expect(document.body).toContainHTML('justify-end');
    // The time stays under the bubble, as on every own turn.
    expect(document.body).toContainHTML('justify-self-end');
  });

  it('an incoming turn is named once when the thread names every turn', () => {
    render(
      <ChatMessageEnhanced
        role="user"
        authorType="user"
        selfAuthorType="admin"
        nameEveryTurn
        name="LAPTOP-88Q44ERC"
        content="I want Call of Duty"
      />,
    );
    expect(screen.getAllByText('LAPTOP-88Q44ERC')).toHaveLength(1);
    expect(document.body).not.toContainHTML('bg-ods-bg-active');
  });

  it("the agent's turn is named beside its mark when the thread names every turn", () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        assistantType="fae"
        selfAuthorType="admin"
        nameEveryTurn
        name="Ava"
        content="Hi"
        timestamp={new Date(2026, 9, 13, 12, 26)}
      />,
    );
    expect(screen.getByRole('img', { name: 'Ava' })).toBeTruthy();
    expect(screen.getByText('Ava')).toBeTruthy();
    // An incoming turn: the time sits on the name row, not under the text.
    expect(document.body).toContainHTML('ml-auto');
    expect(document.body).not.toContainHTML('bg-ods-bg-active');
  });

  it("a user turn with no author type is the user's own in a thread the user owns", () => {
    render(<ChatMessageEnhanced role="user" selfAuthorType="user" content="Hi" />);
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
