package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Response of {@code POST chat/api/v1/dialogs}. {@code id} is the dialogId used for all follow-ups. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DialogResponse {
    private String id;
    private AgentType agentType;
    private DialogMode currentMode;
    private String status;
    private String title;
    private String createdAt;
}
