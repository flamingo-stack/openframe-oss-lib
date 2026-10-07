package com.openframe.api.dto.ticket;

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
    /** Filter by lifecycle status ids. */
    @Size(max = 50)
    private List<String> statusIds;
    @Size(max = 50)
    private List<String> organizationIds;
    /** Filter by linked device: machine ids, the same id {@code UpdateTicketInput.deviceId} takes. */
    @Size(max = 50)
    private List<String> deviceIds;
    @Size(max = 50)
    private List<String> assigneeIds;
    @Size(max = 20)
    private List<String> tagIds;
    /** true keeps only tickets with client-chat messages the caller has not read; false and null do not filter. */
    private Boolean hasUnreadNotifications;
    @Size(max = 3)
    private List<TicketActivityFilter> activity;
    //TODO Backward compatibility alias. Remove after FE alignment
    @Deprecated
    private List<String> labelIds;
}
