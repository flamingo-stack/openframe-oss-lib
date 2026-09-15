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
public class ComplianceRequirement {
    private String standard; // e.g., "NIST", "ISO27001"
    private String control;
    private boolean compliant;
    private String details;
    private Instant lastCheck;
} 
