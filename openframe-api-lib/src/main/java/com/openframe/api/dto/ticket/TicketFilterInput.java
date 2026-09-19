package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.filter.TicketActivityFilter;
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
    /** Filter by custom status ids. */
    @Size(max = 50)
    private List<String> statusIds;
    @Size(max = 50)
    private List<String> organizationIds;
    @Size(max = 50)
    private List<String> assigneeIds;
    @Size(max = 20)
    private List<String> tagIds;
    /** true keeps only tickets the caller has unread notifications about; false and null do not filter. */
    private Boolean hasUnreadNotifications;
    @Size(max = 3)
    private List<TicketActivityFilter> activity;
    //TODO Backward compatibility alias. Remove after FE alignment
    @Deprecated
    private List<String> labelIds;
}
