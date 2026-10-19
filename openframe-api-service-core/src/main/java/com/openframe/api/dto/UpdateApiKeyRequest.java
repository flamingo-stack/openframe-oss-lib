package com.openframe.api.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record UpdateApiKeyRequest(
        String name,
        String description,
        Boolean enabled,
        Instant expiresAt
) {
}
