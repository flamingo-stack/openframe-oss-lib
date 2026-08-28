package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Tool credentials configuration")
public record ToolCredentialsResponse(
        @Schema(description = "Username for authentication") String username,
        @Schema(description = "Password for authentication") String password,
        @Schema(description = "API key configuration") ToolApiKeyResponse apiKey
) {
}
