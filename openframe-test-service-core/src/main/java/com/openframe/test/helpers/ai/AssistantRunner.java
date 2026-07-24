package com.openframe.test.helpers.ai;

import com.openframe.test.api.MessageApi;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.Message;
import com.openframe.test.data.dto.ai.MessageResponse;
import com.openframe.test.data.dto.ai.SendMessageRequest;
import lombok.extern.slf4j.Slf4j;

import java.time.Instant;
import java.util.List;

/**
 * The core abstraction: send a prompt to the assistant on a bound dialog and get back a {@link RunResult}
 * once the run reaches a terminal state, handling the approval gate per the given {@link ApprovalPolicy}.
 * Bind to a dialog created by {@code DialogFixture.forMachine(...)} so the execution target resolves to
 * the intended machine.
 */
@Slf4j
public class AssistantRunner {

    private final String dialogId;
    private final ChatType chatType;
    private final RunWaiter waiter;

    public AssistantRunner(String dialogId) {
        this(dialogId, ChatType.ADMIN_AI_CHAT, new RunWaiter());
    }

    public AssistantRunner(String dialogId, ChatType chatType, RunWaiter waiter) {
        this.dialogId = dialogId;
        this.chatType = chatType;
        this.waiter = waiter;
    }

    public RunResult ask(String prompt) {
        return ask(prompt, ApprovalPolicy.AUTO_APPROVE);
    }

    public RunResult ask(String prompt, ApprovalPolicy policy) {
        MessageResponse sent = MessageApi.sendMessage(SendMessageRequest.builder()
                .dialogId(dialogId)
                .content(prompt)
                .chatType(chatType)
                .build());
        log.info("Sent prompt on dialog {} (user message {}): {}", dialogId, sent.getId(), prompt);

        Instant userSentAt = parseSentAt(sent.getCreatedAt());
        List<Message> messages = waiter.awaitCompletion(dialogId, chatType, userSentAt, policy);
        return new RunResult(messages);
    }

    /**
     * Anchor for the terminal-marker comparison. Uses the server-assigned createdAt of the user message;
     * falls back to a slightly-in-the-past instant if the field is missing, to avoid clock-skew races
     * that could hide a legitimately newer assistant reply.
     */
    private static Instant parseSentAt(String createdAt) {
        if (createdAt != null && !createdAt.isBlank()) {
            try {
                return Instant.parse(createdAt);
            } catch (Exception ignored) {
                // fall through
            }
        }
        return Instant.now().minusSeconds(5);
    }
}
