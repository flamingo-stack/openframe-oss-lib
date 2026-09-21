package com.openframe.api.datafetcher;

import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.ticket.Ticket;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import graphql.relay.Relay;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignmentDataFetcherNodeIdTest {

    private static final Relay RELAY = new Relay();
    private static final String RAW_TICKET_ID = "507f1f77bcf86cd799439011";

    @Mock
    private AssignmentService assignmentService;
    @Mock
    private GraphQLAssignmentMapper mapper;
    @Mock
    private DgsDataFetchingEnvironment dfe;

    // The mutations relay-decode every id they are given, so an id the client reads back has to be
    // the global form or it cannot be handed to unassignItem.
    @Test
    void theTicketIdIsHandedOutInTheFormTheMutationsAccept() {
        AssignmentDataFetcher dataFetcher = new AssignmentDataFetcher(assignmentService, mapper);
        Ticket ticket = new Ticket();
        ticket.setId(RAW_TICKET_ID);
        when(dfe.<Ticket>getSource()).thenReturn(ticket);

        String nodeId = dataFetcher.ticketNodeId(dfe);

        assertThat(nodeId).isEqualTo(RELAY.toGlobalId("Ticket", RAW_TICKET_ID));
        assertThat(RELAY.fromGlobalId(nodeId).getId()).isEqualTo(RAW_TICKET_ID);
    }
}
