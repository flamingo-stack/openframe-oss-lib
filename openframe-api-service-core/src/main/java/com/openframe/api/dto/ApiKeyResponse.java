package com.openframe.api.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * Response DTO for API key information (without the secret)
 */
@Data
@Builder
public class ApiKeyResponse {
    private String id;
    private String name;
    private String description;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
    /** User ID that created the key */
    private String createdBy;
    /** User ID that last modified the key */
    private String updatedBy;
    private Instant lastUsed;
    private Instant expiresAt;
    private Long totalRequests;
    private Long successfulRequests;
    private Long failedRequests;
} 