package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// The tenant's active model configuration of the REST ai-configuration endpoint; hasApiKey says whether a tenant key is stored
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiConfiguration {
    private String id;
    private String provider;
    private String modelName;
    private String displayName;
    private Boolean isActive;
    private Boolean hasApiKey;
    private String createdAt;
    private String updatedAt;
}
