package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// A remote session opened by an approved request; sessionId is a plain 26-char ULID.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class RemoteSession {
    private String sessionId;
    private String requestId;
    private String deviceId;
    private String technicianId;
    private String sessionKind;
    private String mode;
    private String status;
    private Instant startedAt;
    private Instant endedAt;
    private String endReason;
    private String reason;
    private String ticketId;
    private Boolean recordingEnabled;
    private String dialogId;
    private Long durationMs;
    private String recordingState;
    private RemoteAccessTechnician technician;
}
