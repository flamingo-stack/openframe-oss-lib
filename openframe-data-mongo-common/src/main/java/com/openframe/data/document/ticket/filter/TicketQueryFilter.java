package com.openframe.data.document.ticket.filter;

import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Filter object for ticket queries.
 * Follows the same pattern as MachineQueryFilter.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketQueryFilter {
    // ===== Legacy (lifecycle feature flag OFF) =====
    private List<TicketStatus> statuses;

    // ===== Lifecycle feature (lifecycle feature flag ON) =====
    private List<String> statusIds;
    private List<TicketStatusKind> statusKinds;

    // ===== Shared =====
    private List<String> organizationIds;
    private List<String> assigneeIds;
    private List<String> labelIds;
    private List<String> deviceIds;
}
