package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Request DTO for creating a new API key
 */
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CreateApiKeyRequest {
    private String name;
    private String description;
    private Instant expiresAt;
}
