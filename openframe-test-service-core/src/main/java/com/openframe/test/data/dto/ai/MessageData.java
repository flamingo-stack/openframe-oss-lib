package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Flattened view of the AI agent's {@code messageData} union. The GraphQL query selects the fields the
 * harness needs across several concrete types (TextData, ExecutedToolData, ApprovalRequestData,
 * ErrorData) via inline fragments; {@code type} discriminates, and fields not present on a given
 * variant stay null.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MessageData {
    private MessageDataType type;

    // TextData
    private String text;

    // ExecutedToolData
    private String toolFunction;
    private String result;
    private Boolean success;

    // ApprovalRequestData
    private String approvalRequestId;
    private String command;

    // ErrorData
    private String error;
    private String details;
}
