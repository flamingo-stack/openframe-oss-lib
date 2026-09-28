package com.openframe.test.data.dto.ai;

/**
 * Discriminator for the {@code messageData} union in the AI agent GraphQL schema. Carried by the
 * {@code type} field of each {@link MessageData} entry.
 *
 * <p>This must list <em>every</em> value the server can emit, in the same order as
 * {@code openframe-saas-ai-agent/src/main/resources/schema/message.graphqls}, because Jackson fails
 * the whole {@code MessageConnection} on an unknown enum value rather than the one message carrying
 * it. A single un-modelled variant anywhere in a conversation therefore sinks the entire run, and the
 * failure surfaces as an unrelated-looking deserialization error rather than as missing data. The
 * harness needs no fields from most of these — only the constant has to exist. Mirror the schema when
 * it grows; do not prune values just because no test reads them.
 */
public enum MessageDataType {
    TEXT,
    EXECUTING_TOOL,
    EXECUTED_TOOL,
    ERROR,
    APPROVAL_REQUEST,
    APPROVAL_RESULT,
    ESCALATION_OFFER,
    TICKET_ESCALATED,
    TICKET_EVENT,
    SYSTEM,
    CONTEXT_COMPACTION_START,
    CONTEXT_COMPACTION_END,
    THINKING,
    GUIDE,
    /**
     * The assistant putting a question back to the caller instead of acting — emitted when the intent
     * router cannot decide where a message belongs. Its payload ({@code question}, {@code options}) is
     * projected onto {@link MessageData} so a run that ends in an ASK reports what was asked.
     */
    ASK
}
