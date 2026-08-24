package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Response DTO for API key creation (includes the full key)
 */
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreateApiKeyResponse {
    private ApiKeyResponse apiKey;
    private String fullKey;
}
