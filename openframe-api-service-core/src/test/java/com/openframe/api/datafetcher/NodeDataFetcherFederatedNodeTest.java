package com.openframe.api.datafetcher;

import com.openframe.api.relay.FederatedNodeReference;
import com.openframe.api.relay.FederatedNodeTypes;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.ticket.TicketService;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeDataFetcherFederatedNodeTest {

    private static final String DIALOG_ID = "665f1c2ab3e4d5f6a7b8c9e1";
    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";

    @Mock private DeviceService deviceService;
    @Mock private OrganizationService organizationService;
    @Mock private ToolService toolService;
    @Mock private TagService tagService;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private ScriptService scriptService;
    @Mock private ScriptExecutionService scriptExecutionService;
    @Mock private ScheduleScriptService scheduleScriptService;
    @Mock private ScheduleRunService scheduleRunService;
    @Mock private TicketService ticketService;
    @Mock private FederatedNodeTypes federatedNodeTypes;

    private final RelayIdCodec codec = new RelayIdCodec();
    private Ticket ticket;

    @BeforeEach
    void setUp() {
        ticket = Ticket.builder().id(TICKET_ID).build();
    }

    @Test
    void node_federatedType_referenceWithRawId() {
        // setup
        when(federatedNodeTypes.types()).thenReturn(EnumSet.of(NodeType.DIALOG));
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        NodeDataFetcher fetcher = fetcher(ticketService, federatedNodeTypes);

        // execution
        Object node = fetcher.node(dialogGlobalId);

        // verifications
        assertThat(node)
                .isInstanceOf(FederatedNodeReference.class)
                .extracting("typeName", "id")
                .containsExactly("Dialog", DIALOG_ID);
    }

    @Test
    void node_noFederatedTypesBean_unsupportedType() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        NodeDataFetcher fetcher = fetcher(ticketService, null);

        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> fetcher.node(dialogGlobalId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Unsupported node type: Dialog");
    }

    @Test
    void node_ticketGlobalId_loadedThroughTicketService() {
        // setup
        when(federatedNodeTypes.types()).thenReturn(EnumSet.of(NodeType.DIALOG));
        when(ticketService.findTicketById(TICKET_ID)).thenReturn(Optional.of(ticket));
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        NodeDataFetcher fetcher = fetcher(ticketService, federatedNodeTypes);

        // execution
        Object node = fetcher.node(ticketGlobalId);

        // verifications
        assertThat(node).isSameAs(ticket);
    }

    @Test
    void node_ticketServiceAbsent_null() {
        // setup
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        NodeDataFetcher fetcher = fetcher(null, null);

        // execution
        Object node = fetcher.node(ticketGlobalId);

        // verifications
        assertThat(node).isNull();
    }

    @Test
    void nodes_federatedAndMissingTicket_referenceAndNull() {
        // setup
        when(federatedNodeTypes.types()).thenReturn(EnumSet.of(NodeType.DIALOG));
        when(ticketService.findTicketById(TICKET_ID)).thenReturn(Optional.empty());
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        NodeDataFetcher fetcher = fetcher(ticketService, federatedNodeTypes);

        // execution
        List<Object> nodes = fetcher.nodes(List.of(dialogGlobalId, ticketGlobalId));

        // verifications
        assertThat(nodes).satisfiesExactly(
                first -> assertThat(first).isInstanceOf(FederatedNodeReference.class),
                second -> assertThat(second).isNull());
    }

    private NodeDataFetcher fetcher(TicketService tickets, FederatedNodeTypes federated) {
        return new NodeDataFetcher(deviceService, organizationService, toolService, tagService,
                toolConnectionService, installedAgentService, scriptService, scriptExecutionService,
                scheduleScriptService, scheduleRunService, providerOf(null), providerOf(null), codec,
                providerOf(tickets), providerOf(federated));
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> providerOf(T bean) {
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        lenient().when(provider.getIfAvailable()).thenReturn(bean);
        return provider;
    }
}
