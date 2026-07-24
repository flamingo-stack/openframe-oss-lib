package com.openframe.test.data.dto.ai;

/**
 * Type of a context item referenced by a message. Context items only enrich the prompt text; they do
 * <em>not</em> set the execution target machine (that resolves from the dialog's ticket).
 */
public enum ContextItemType {
    DEVICE,
    SCRIPT,
    TICKET,
    ORGANIZATION,
    USER,
    KB_ARTICLE,
    POLICY,
    QUERY,
    SCHEDULED_SCRIPT
}
