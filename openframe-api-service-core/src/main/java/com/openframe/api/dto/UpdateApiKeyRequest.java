package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Request DTO for updating an existing API key
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateApiKeyRequest {
    private String name;
    private String description;
    private Boolean enabled;
    private Instant expiresAt;
}
