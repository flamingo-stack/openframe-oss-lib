package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Tool API key configuration")
public class ToolApiKeyResponse {
    @Schema(description = "API key value") private final String key;
    @Schema(description = "API key type", example = "BEARER_TOKEN") private final String type;
    @Schema(description = "API key name/label", example = "Authorization") private final String keyName;
}

