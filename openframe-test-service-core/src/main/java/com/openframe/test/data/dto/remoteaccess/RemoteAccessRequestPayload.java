package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.UserError;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// createRemoteAccessRequest / revokeRemoteAccessRequest payload; refusals arrive as coded userErrors.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteAccessRequestPayload {
    private RemoteAccessRequest request;
    private Boolean created;
    private List<UserError> userErrors;

    public List<String> codes() {
        return userErrors == null ? List.of() : userErrors.stream().map(UserError::getCode).toList();
    }
}
