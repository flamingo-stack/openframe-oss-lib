package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatus;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketFilterInput {
    @Size(max = 5)
    private List<TicketStatus> statuses;
    /** Lifecycle feature: filter by custom status ids (openframe.features.tickets.lifecycle.enabled). */
    @Size(max = 50)
    private List<String> statusIds;
    @Size(max = 50)
    private List<String> organizationIds;
    @Size(max = 50)
    private List<String> assigneeIds;
    @Size(max = 20)
    private List<String> tagIds;
    //TODO Backward compatibility alias. Remove after FE alignment
    @Deprecated
    private List<String> labelIds;
}
