package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// Effective guardrails of one organization: the tenant rules while inheritDefault is true, else its own materialized rules
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrganizationGuardrails {
    private String organizationId;
    private Boolean inheritDefault;
    private String sourceTemplate;
    private Boolean active;
    private List<GuardrailRule> rules;
    private List<GuardrailOverride> overrides;
}
