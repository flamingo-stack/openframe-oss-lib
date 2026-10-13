package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Flattened GraphQL messageData union; type discriminates, fields absent from a variant stay null
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
    private ApprovalType approvalType;
    private List<PendingToolCall> toolCalls;

    // ErrorData
    private String error;
    private String details;

    // AskData -- the router's disambiguation question and the choices it offered. Without these a run
    // that ends in an ASK dumps a bare "ASK:" line, and what was actually asked is only recoverable
    // from the agent's upstream request log.
    private String question;
    private List<AskOption> options;

    // ContextCompactionEndData -- the summary that replaced the compacted history in the model's memory
    private String summary;
}
