package com.openframe.data.document.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {
    private String id;
    private String severity;  // HIGH, MEDIUM, LOW
    private String message;
    private Instant timestamp;
    private boolean resolved;
}
