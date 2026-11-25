package com.openframe.api.dto;

import com.openframe.api.validation.ValidationPatterns;
import jakarta.validation.constraints.Pattern;
import lombok.Builder;

import java.time.Instant;

/**
 * Request DTO for updating an existing API key
 */
@Builder
public record UpdateApiKeyRequest(
        @Pattern(regexp = ValidationPatterns.NOT_BLANK, message = "name must not be blank")
        String name,
        String description,
        Boolean enabled,
        Instant expiresAt
) {
}
