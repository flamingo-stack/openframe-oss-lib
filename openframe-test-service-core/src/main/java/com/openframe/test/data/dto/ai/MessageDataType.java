package com.openframe.test.data.dto.ai;

/**
 * Discriminator for the {@code messageData} union in the AI agent GraphQL schema. Carried by the
 * {@code type} field of each {@link MessageData} entry.
 */
public enum MessageDataType {
    TEXT,
    /**
     * The assistant putting a question back to the caller instead of acting. The harness selects no
     * fields on its concrete type (see {@code ChatQueries.MESSAGES}), so the discriminator is all it
     * needs — but the constant must be listed here regardless: Jackson fails the whole
     * {@code MessageConnection} on an unknown enum value, so a single un-modelled variant anywhere in
     * the conversation sinks the entire run rather than just that one message.
     */
    ASK,
    EXECUTING_TOOL,
    EXECUTED_TOOL,
    ERROR,
    APPROVAL_REQUEST,
    APPROVAL_RESULT,
    SYSTEM,
    CONTEXT_COMPACTION_START,
    CONTEXT_COMPACTION_END,
    THINKING
}
