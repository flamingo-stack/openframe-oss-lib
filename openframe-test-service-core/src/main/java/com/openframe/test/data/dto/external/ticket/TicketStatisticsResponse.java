package com.openframe.test.data.dto.external.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ticket statistics
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketStatisticsResponse {

    private Integer totalCount;

    private List<StatusCount> statusCounts;

    private List<StatusDefinitionCount> statusDefinitionCounts;

    private String averageResolutionTimeFormatted;

    private Double averageRating;
}
