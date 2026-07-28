package com.openframe.test.data.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response of {@code POST chat/api/v1/messages}. Returns immediately with the <em>user</em> message id;
 * the assistant runs asynchronously and its output is read via the {@code messages} GraphQL query.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class MessageResponse {
    private String id;
    private String dialogId;
    private ChatType chatType;
    private String createdAt;
}
