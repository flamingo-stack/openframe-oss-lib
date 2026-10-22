package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// One technician connect attempt on a device; requestId is a plain 26-char ULID and deviceId the OpenFrame machine id.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteAccessRequest {
    private String requestId;
    private String deviceId;
    private String technicianId;
    private String sessionKind;
    private String status;
    private String mode;
    private String decisionSource;
    private String reason;
    private String ticketId;
    private Boolean recordingEnabled;
    private Instant createdAt;
    private Instant deliveredAt;
    private Instant expiresAt;
    private Instant resolvedAt;
}
