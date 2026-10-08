package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dataloader.TicketStatusDefinitionDataLoader;
import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import org.dataloader.DataLoader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * An assigned ticket is rendered with the same status chip as the board, so this target has to
 * carry the lifecycle status: the kind drives the canonical styling, the definition carries the
 * name and colour a custom column is drawn from. The legacy string cannot stand in — it collapses
 * every custom column into TECH_REQUIRED.
 */
@ExtendWith(MockitoExtension.class)
class AssignmentDataFetcherTicketStatusTest {

    private static final String TICKET_ID = "507f1f77bcf86cd799439011";
    private static final String STATUS_ID = "st-waiting";

    @Mock private AssignmentService assignmentService;
    @Mock private GraphQLAssignmentMapper mapper;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Mock private DataLoader<String, TicketStatusDefinition> statusLoader;

    private AssignmentDataFetcher dataFetcher() {
        return new AssignmentDataFetcher(assignmentService, mapper, new RelayIdCodec());
    }

    @Test
    void theKindComesStraightFromTheDocument() {
        when(dfe.<Ticket>getSource()).thenReturn(ticket(TicketStatusKind.CUSTOM, STATUS_ID));

        assertThat(dataFetcher().ticketStatusKind(dfe)).isEqualTo(TicketStatusKind.CUSTOM);
    }

    @Test
    void aTicketWithoutAKindReportsNone() {
        when(dfe.<Ticket>getSource()).thenReturn(ticket(null, null));

        assertThat(dataFetcher().ticketStatusKind(dfe)).isNull();
    }

    @Test
    void theDefinitionIsLoadedByStatusId() {
        TicketStatusDefinition waiting = definition(STATUS_ID, "Waiting for parts", "#f0c674");
        when(dfe.<Ticket>getSource()).thenReturn(ticket(TicketStatusKind.CUSTOM, STATUS_ID));
        when(dfe.<String, TicketStatusDefinition>getDataLoader(TicketStatusDefinitionDataLoader.NAME))
                .thenReturn(statusLoader);
        when(statusLoader.load(STATUS_ID)).thenReturn(CompletableFuture.completedFuture(waiting));

        TicketStatusDefinition resolved = dataFetcher().ticketStatusDefinition(dfe).join();

        assertThat(resolved.getName()).isEqualTo("Waiting for parts");
        assertThat(resolved.getColor()).isEqualTo("#f0c674");
    }

    /** Nothing to look up, and asking the loader for a null key would blow up the batch. */
    @Test
    void aTicketWithoutAStatusIdIsNotLookedUp() {
        when(dfe.<Ticket>getSource()).thenReturn(ticket(null, null));

        assertThat(dataFetcher().ticketStatusDefinition(dfe).join()).isNull();

        verify(statusLoader, never()).load(org.mockito.ArgumentMatchers.anyString());
    }

    private static Ticket ticket(TicketStatusKind kind, String statusId) {
        Ticket ticket = new Ticket();
        ticket.setId(TICKET_ID);
        ticket.setStatusKind(kind);
        ticket.setStatusId(statusId);
        return ticket;
    }

    private static TicketStatusDefinition definition(String id, String name, String color) {
        return TicketStatusDefinition.builder()
                .id(id)
                .kind(TicketStatusKind.CUSTOM)
                .name(name)
                .color(color)
                .position("0|hzzzzz:")
                .build();
    }
}
