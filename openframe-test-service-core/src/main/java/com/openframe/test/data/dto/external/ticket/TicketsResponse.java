package com.openframe.test.data.dto.external.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.openframe.test.data.dto.external.common.PageInfo;
import java.util.List;

/**
 * Paginated list of tickets
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketsResponse {

    private List<TicketResponse> tickets;

    private PageInfo pageInfo;

    private Integer filteredCount;
}
