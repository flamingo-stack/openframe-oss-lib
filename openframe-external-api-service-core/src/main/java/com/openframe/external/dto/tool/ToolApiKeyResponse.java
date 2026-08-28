package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tool API key configuration")
public record ToolApiKeyResponse(
        @Schema(description = "API key value") String key,
        @Schema(description = "API key type", example = "BEARER_TOKEN") String type,
        @Schema(description = "API key name/label", example = "Authorization") String keyName
) {
}
