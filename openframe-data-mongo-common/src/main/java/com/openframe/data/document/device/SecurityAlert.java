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
public class SecurityAlert {
    private String id;
    private String severity;
    private String description;
    private Instant detectedAt;
    private boolean resolved;
    private Instant resolvedAt;
    private String resolution;
} 
