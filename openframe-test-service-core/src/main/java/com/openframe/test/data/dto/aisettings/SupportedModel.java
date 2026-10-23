package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** One entry of the tenant's {@code ai.supported-models}, as the AI settings UI lists them. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SupportedModel {
    private String modelName;
    private String displayName;
    private String provider;
    private Integer contextWindow;
}
