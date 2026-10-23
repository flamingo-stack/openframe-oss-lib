package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// One remoteAccessRequests audit row; session is the session the request opened, null otherwise.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteAccessRequestAudit {
    private String requestId;
    private String deviceId;
    private String sessionKind;
    private String status;
    private String mode;
    private String policyScope;
    private String decisionSource;
    private String appliedFallback;
    private String reason;
    private Instant createdAt;
    private Instant resolvedAt;
    private Instant expiresAt;
    private RemoteAccessTechnician technician;
    private RemoteSession session;
}
