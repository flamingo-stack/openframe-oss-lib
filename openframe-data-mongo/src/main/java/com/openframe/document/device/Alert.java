package com.openframe.document.device;

import lombok.Data;

import java.time.Instant;

@Data
public class Alert {
    private String id;
    private String severity;  // HIGH, MEDIUM, LOW
    private String message;
    private Instant timestamp;
    private boolean resolved;
}
