package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One tool invocation waiting on an approval, carried by {@code ApprovalRequestData.toolCalls}.
 *
 * <p>This is where the command actually is. {@code ApprovalRequestData.command} is null on every request
 * this suite has observed (5/5 and 3/3 across two qa runs), so anything that matches on the command text —
 * "did it ask to delete the file?" — has to read {@link #toolCallArguments} instead.
 *
 * <p>{@code toolCallArguments} is the schema's {@code JSON} scalar, so it deserializes to whatever shape
 * the tool declares (usually a map of argument name to value). It is typed as {@link Object} because the
 * harness only ever renders it to text for substring matching, and pinning a shape would break the moment
 * a tool takes different arguments.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PendingToolCall {
    private String toolName;
    private String toolType;
    private Object toolCallArguments;
    private ApprovalType approvalType;
}
