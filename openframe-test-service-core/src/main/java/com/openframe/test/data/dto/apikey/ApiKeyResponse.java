package com.openframe.test.data.dto.apikey;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * An API key's metadata, without the secret. Mirrors {@code com.openframe.api.dto.ApiKeyResponse}.
 *
 * <p>{@link #id} is the {@code ak_*} key id — the same value the gateway reports in its rate-limit
 * buckets, and the path variable every {@code /api/api-keys/{keyId}} call takes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ApiKeyResponse {

    private String id;

    private String name;

    private String description;

    private Boolean enabled;

    private Instant createdAt;

    private Instant updatedAt;

    private String createdBy;

    private String updatedBy;

    private Instant lastUsed;

    private Instant expiresAt;

    private Long totalRequests;

    private Long successfulRequests;

    private Long failedRequests;
}
