package com.openframe.api.dto.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketFilters {
    private List<TicketFilterOption> statuses;
    private List<TicketFilterOption> organizationIds;
    private List<TicketFilterOption> assigneeIds;
    private List<TicketFilterOption> tagIds;
}
