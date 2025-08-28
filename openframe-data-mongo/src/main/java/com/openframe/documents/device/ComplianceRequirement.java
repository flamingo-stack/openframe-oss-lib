package com.openframe.documents.device;

import lombok.Data;

import java.time.Instant;

@Data
public class ComplianceRequirement {
    private String standard; // e.g., "NIST", "ISO27001"
    private String control;
    private boolean compliant;
    private String details;
    private Instant lastCheck;
} 