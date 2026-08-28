package com.openframe.test.data.dto.external.log;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Detailed log information response for REST API
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LogDetailsResponse {

    private String toolEventId;

    private String eventType;

    private String ingestDay;

    private String toolType;

    private String severity;

    private String userId;

    private String deviceId;

    private String hostname;

    private String organizationId;

    private String organizationName;

    private String summary;

    private String message;

    private String content;

    private Instant timestamp;
}
