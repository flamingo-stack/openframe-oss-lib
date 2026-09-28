package com.openframe.test.data.dto.external.tool;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Integrated tool response
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ToolResponse {

    private String id;

    private String name;

    private String description;

    private String icon;

    private List<ToolUrlResponse> toolUrls;

    private String type;

    private String toolType;

    private String category;

    private String platformCategory;

    private Boolean enabled;

    private ToolCredentialsResponse credentials;

    private String layer;

    private Integer layerOrder;

    private String layerColor;

    private String metricsPath;

    private String healthCheckEndpoint;

    private Integer healthCheckInterval;

    private Integer connectionTimeout;

    private Integer readTimeout;

    private List<String> allowedEndpoints;
}
