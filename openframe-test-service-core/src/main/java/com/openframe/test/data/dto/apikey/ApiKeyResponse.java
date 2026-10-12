package com.openframe.test.data.dto.apikey;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

// API key metadata without the secret; mirrors com.openframe.api.dto.ApiKeyResponse.
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
