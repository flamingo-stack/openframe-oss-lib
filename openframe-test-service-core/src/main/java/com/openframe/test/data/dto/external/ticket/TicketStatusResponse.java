package com.openframe.test.data.dto.external.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Ticket lifecycle status definition
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketStatusResponse {

    private String id;

    private String name;

    private String color;

    private String position;

    /** Contract values: AI_ASSISTANCE, TECH_REQUIRED, RESOLVED, ARCHIVED, CUSTOM. Kept as String so a new backend value deserializes rather than throwing. */
    private String kind;

    private Boolean isSystem;

    private String systemKey;

    private Instant createdAt;

    private Instant updatedAt;
}
