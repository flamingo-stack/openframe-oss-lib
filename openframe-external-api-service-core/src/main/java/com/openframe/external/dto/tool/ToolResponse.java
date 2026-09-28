package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Integrated tool response")
public class ToolResponse {
    
    @Schema(description = "Tool ID", example = "tool-123")
    private String id;
    
    @Schema(description = "Tool name", example = "meshcentral")
    private String name;
    
    @Schema(description = "Tool description", example = "Remote monitoring and management tool")
    private String description;
    
    @Schema(description = "Tool icon", example = "meshcentral-icon")
    private String icon;
    
    @Schema(description = "Tool URLs")
    private List<ToolUrlResponse> toolUrls;
    
    @Schema(description = "Tool type", example = "rmm")
    private String type;
    
    @Schema(description = "Tool type classification", example = "monitoring")
    private String toolType;
    
    @Schema(description = "Tool category", example = "monitoring")
    private String category;
    
    @Schema(description = "Platform category", example = "web")
    private String platformCategory;
    
    @Schema(description = "Whether the tool is enabled", example = "true")
    private Boolean enabled;
    
    @Schema(description = "Tool credentials")
    private ToolCredentialsResponse credentials;

    @Schema(description = "Architecture layer the tool belongs to", example = "Integrated Tools")
    private String layer;

    @Schema(description = "Ordering of the tool within its layer", example = "1")
    private Integer layerOrder;

    @Schema(description = "Display color of the layer", example = "#4F46E5")
    private String layerColor;

    @Schema(description = "Metrics endpoint path", example = "/metrics")
    private String metricsPath;

    @Schema(description = "Health check endpoint", example = "/health")
    private String healthCheckEndpoint;

    @Schema(description = "Health check interval in seconds", example = "30")
    private Integer healthCheckInterval;

    @Schema(description = "Connection timeout in milliseconds", example = "5000")
    private Integer connectionTimeout;

    @Schema(description = "Read timeout in milliseconds", example = "30000")
    private Integer readTimeout;

    @Schema(description = "Endpoints allowed to be proxied through the integration API")
    private List<String> allowedEndpoints;
} 