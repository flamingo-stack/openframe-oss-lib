package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
@Schema(description = "Tool URL configuration")
public class ToolUrlResponse {
    @Schema(description = "URL endpoint", example = "https://rmm.example.com") private final String url;
    @Schema(description = "Port number", example = "8443") private final String port;
    @Schema(description = "URL type", example = "DASHBOARD") private final String type;
}
