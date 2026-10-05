package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// approvalLevel is ALLOW | ASK_USER | ASK_TECHNICIAN | DENY
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GuardrailRule {
    private String tool;
    private String function;
    private String policyGroup;
    private String category;
    private String operation;
    private String commandPattern;
    private String approvalLevel;
    private String naturalKey;
}
