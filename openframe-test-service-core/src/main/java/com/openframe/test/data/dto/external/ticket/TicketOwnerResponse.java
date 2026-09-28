package com.openframe.test.data.dto.external.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Ticket owner
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketOwnerResponse {

    /** Contract values: CLIENT, ADMIN. Kept as String so a new backend value deserializes rather than throwing. */
    private String type;

    private String machineId;

    private String userId;
}
