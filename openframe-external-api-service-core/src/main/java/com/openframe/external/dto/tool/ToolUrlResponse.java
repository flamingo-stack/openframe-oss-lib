package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Schema(description = "Tool URL configuration")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolUrlResponse {
    @Schema(description = "URL endpoint", example = "https://rmm.example.com") private String url;
    @Schema(description = "Port number", example = "8443") private String port;
    @Schema(description = "URL type", example = "DASHBOARD") private String type;
}
