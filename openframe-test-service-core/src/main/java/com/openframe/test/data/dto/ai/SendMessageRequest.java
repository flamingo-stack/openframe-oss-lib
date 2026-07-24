package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Body for {@code POST chat/api/v1/messages}. Note there is deliberately <em>no</em> {@code machineId}
 * field — the execution target resolves server-side from the dialog's ticket. {@code contextItems}
 * only enrich prompt text and do not set the target.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SendMessageRequest {
    private String dialogId;
    private String content;
    private ChatType chatType;
    private List<ContextItemReference> contextItems;
}
