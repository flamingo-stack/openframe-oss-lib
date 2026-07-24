package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Body for {@code POST chat/api/v1/dialogs}. For ADMIN-with-ticket targeting, set
 * {@code agentType = ADMIN} and {@code ticketId} to a ticket whose {@code deviceId} is the target
 * machine; {@code chatType} is not carried here — it is set per message.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateDialogRequest {
    private AgentType agentType;
    private String ticketId;
    private DialogMode mode;
}
