package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiConfigurationTestResult {
    private Boolean success;
    private String message;
    private String provider;
    private String model;
    private String testResponse;
}
