package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One guardrail policy of GET chat/api/v1/policies; type is TEMPLATE | CUSTOM
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiPolicySummary {
    private String id;
    private String displayName;
    private String description;
    private String type;
    private Boolean isActive;
    private Integer customOverridesCount;
}
