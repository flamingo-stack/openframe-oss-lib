package com.openframe.external.dto.ticket;

import com.openframe.api.dto.shared.PageInfo;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated list of tickets")
public class TicketsResponse {

    @Schema(description = "Tickets on the current page")
    private List<TicketResponse> tickets;

    @Schema(description = "Pagination information (cursors are ticket ids)")
    private PageInfo pageInfo;

    @Schema(description = "Total count of tickets matching the filter")
    private Integer filteredCount;
}
