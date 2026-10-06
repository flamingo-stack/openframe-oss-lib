package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.UserError;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// endRemoteSession payload; refusals arrive as coded userErrors, REMOTE_SESSION_ENDED with the ended session.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteSessionPayload {
    private RemoteSession session;
    private List<UserError> userErrors;

    public List<String> codes() {
        return userErrors == null ? List.of() : userErrors.stream().map(UserError::getCode).toList();
    }
}
