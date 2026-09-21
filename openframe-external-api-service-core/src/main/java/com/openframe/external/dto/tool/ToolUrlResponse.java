package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tool URL configuration")
public record ToolUrlResponse(
        @Schema(description = "URL endpoint", example = "https://rmm.example.com") String url,
        @Schema(description = "Port number", example = "8443") String port,
        @Schema(description = "URL type", example = "DASHBOARD") String type
) {
}
