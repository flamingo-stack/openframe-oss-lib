package com.openframe.external.dto.ticket;

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
@Schema(description = "Available ticket filter options")
public class TicketFiltersResponse {

    @Schema(description = "Statuses (values are status ids on lifecycle tenants, legacy status names otherwise)")
    private List<TicketFilterOptionResponse> statuses;

    @Schema(description = "Organizations (values are organizationIds)")
    private List<TicketFilterOptionResponse> organizationIds;

    @Schema(description = "Assignees (values are user ids)")
    private List<TicketFilterOptionResponse> assigneeIds;

    @Schema(description = "Tags (values are tag ids)")
    private List<TicketFilterOptionResponse> tagIds;
}
