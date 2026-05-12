package com.openframe.data.document.ticket.filter;

import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.document.ticket.TicketCreationSource;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketQueryFilter {
    private List<String> statusIds;
    private List<TicketStatusKind> statusKinds;
    private List<String> organizationIds;
    private List<String> assigneeIds;
    private List<String> labelIds;
    private List<String> deviceIds;
    private List<TicketCreationSource> creationSources;
    private Instant createdAtFrom;
    private Instant createdAtTo;
}
