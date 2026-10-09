package com.openframe.external.dto.tool;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Schema(description = "Tool credentials configuration")
public class ToolCredentialsResponse {
    @Schema(description = "Username for authentication") private final String username;
    @Schema(description = "Password for authentication") private final String password;
    @Schema(description = "API key configuration") private final ToolApiKeyResponse apiKey;
}

