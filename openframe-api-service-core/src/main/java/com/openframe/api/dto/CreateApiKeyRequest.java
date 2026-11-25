package com.openframe.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

import java.time.Instant;

/**
 * Request DTO for creating a new API key
 */
@Builder
public record CreateApiKeyRequest(
        @NotBlank(message = "name must not be blank")
        String name,
        String description,
        Instant expiresAt
) {
}
