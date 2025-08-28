package com.openframe.documents.device;

import lombok.Data;

import java.time.Instant;

@Data
public class SecurityAlert {
    private String id;
    private String severity;
    private String description;
    private Instant detectedAt;
    private boolean resolved;
    private Instant resolvedAt;
    private String resolution;
} 