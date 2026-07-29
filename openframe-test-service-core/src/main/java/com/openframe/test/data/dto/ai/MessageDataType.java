package com.openframe.test.data.dto.ai;

/**
 * Discriminator for the {@code messageData} union in the AI agent GraphQL schema. Carried by the
 * {@code type} field of each {@link MessageData} entry.
 */
public enum MessageDataType {
    TEXT,
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
