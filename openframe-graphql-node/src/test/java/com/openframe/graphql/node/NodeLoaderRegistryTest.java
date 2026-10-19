package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeLoaderRegistryTest {

    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";

    @Mock private NodeLoader<SupportTicket> ticketLoader;
    @Mock private NodeLoader<Policy> policyLoader;
    @Mock private NodeLoader<UrgentTicket> urgentTicketLoader;

    private AuthPrincipal principal;
    private SupportTicket ticket;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("user-1").build();
        ticket = new SupportTicket(TICKET_ID, "Printer jam");
    }

    @Test
    void find_registeredType_delegatesTheRawIdToItsLoader() {
        // setup
        stubTicketLoader();
        when(ticketLoader.find(principal, TICKET_ID)).thenReturn(Optional.of(ticket));
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<Object> node = registry.find(principal, NodeType.TICKET, TICKET_ID);

        // verifications
        assertThat(node).containsSame(ticket);
    }

    @Test
    void find_loaderFindsNothing_empty() {
        // setup
        stubTicketLoader();
        when(ticketLoader.find(principal, TICKET_ID)).thenReturn(Optional.empty());
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<Object> node = registry.find(principal, NodeType.TICKET, TICKET_ID);

        // verifications
        assertThat(node).isEmpty();
    }

    @Test
    void find_typeWithoutLoader_emptyWithoutLookup() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<Object> node = registry.find(principal, NodeType.MACHINE, TICKET_ID);

        // verifications
        assertThat(node).isEmpty();
        verify(ticketLoader, never()).find(eq(principal), nullable(String.class));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void find_blankRawId_emptyWithoutLookup(String rawId) {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<Object> node = registry.find(principal, NodeType.TICKET, rawId);

        // verifications
        assertThat(node).isEmpty();
        verify(ticketLoader, never()).find(eq(principal), nullable(String.class));
    }

    @Test
    void hasLoader_registeredType_true() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        boolean hasLoader = registry.hasLoader(NodeType.TICKET);

        // verifications
        assertThat(hasLoader).isTrue();
    }

    @Test
    void hasLoader_typeWithoutLoader_false() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        boolean hasLoader = registry.hasLoader(NodeType.MACHINE);

        // verifications
        assertThat(hasLoader).isFalse();
    }

    @Test
    void findTypeName_instanceOfALoaderClass_itsGraphqlTypeName() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<String> typeName = registry.findTypeName(ticket);

        // verifications
        assertThat(typeName).contains("Ticket");
    }

    @Test
    void findTypeName_subclassOfALoaderClass_theLoaderTypeName() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();
        UrgentTicket urgentTicket = new UrgentTicket(TICKET_ID, "Server down");

        // execution
        Optional<String> typeName = registry.findTypeName(urgentTicket);

        // verifications
        assertThat(typeName).contains("Ticket");
    }

    @Test
    void findTypeName_exactClassAndAssignableLoaderRegisteredFirst_exactClassWins() {
        // setup
        stubTicketLoader();
        stubUrgentTicketLoader();
        List<NodeLoader<?>> loaders = List.of(ticketLoader, urgentTicketLoader);
        NodeLoaderRegistry registry = new NodeLoaderRegistry(loaders);
        UrgentTicket urgentTicket = new UrgentTicket(TICKET_ID, "Server down");

        // execution
        Optional<String> typeName = registry.findTypeName(urgentTicket);

        // verifications
        assertThat(typeName).contains("TicketNote");
    }

    @Test
    void findTypeName_twoAssignableLoaders_firstRegisteredWins() {
        // setup
        stubTicketLoader();
        stubUrgentTicketLoader();
        List<NodeLoader<?>> loaders = List.of(ticketLoader, urgentTicketLoader);
        NodeLoaderRegistry registry = new NodeLoaderRegistry(loaders);
        CriticalTicket criticalTicket = new CriticalTicket(TICKET_ID, "Data loss");

        // execution
        Optional<String> typeName = registry.findTypeName(criticalTicket);

        // verifications
        assertThat(typeName).contains("Ticket");
    }

    @Test
    void findTypeName_twoAssignableLoadersRegisteredInReverse_firstRegisteredWins() {
        // setup
        stubTicketLoader();
        stubUrgentTicketLoader();
        List<NodeLoader<?>> loaders = List.of(urgentTicketLoader, ticketLoader);
        NodeLoaderRegistry registry = new NodeLoaderRegistry(loaders);
        CriticalTicket criticalTicket = new CriticalTicket(TICKET_ID, "Data loss");

        // execution
        Optional<String> typeName = registry.findTypeName(criticalTicket);

        // verifications
        assertThat(typeName).contains("TicketNote");
    }

    @Test
    void findTypeName_objectOfNoLoaderClass_empty() {
        // setup
        stubTicketLoader();
        NodeLoaderRegistry registry = ticketRegistry();

        // execution
        Optional<String> typeName = registry.findTypeName("not a node");

        // verifications
        assertThat(typeName).isEmpty();
    }

    @Test
    void constructor_twoLoadersForOneType_throwsIllegalState() {
        // setup
        when(ticketLoader.type()).thenReturn(NodeType.TICKET);
        when(policyLoader.type()).thenReturn(NodeType.TICKET);
        List<NodeLoader<?>> loaders = List.of(ticketLoader, policyLoader);

        // execution
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> new NodeLoaderRegistry(loaders));

        // verifications
        assertThat(exception.getMessage()).contains("Duplicate key TICKET");
    }

    @Test
    void constructor_twoLoadersForOneClass_throwsIllegalState() {
        // setup
        stubTicketLoader();
        when(policyLoader.type()).thenReturn(NodeType.GUARDRAIL_POLICY);
        doReturn(SupportTicket.class).when(policyLoader).nodeClass();
        List<NodeLoader<?>> loaders = List.of(ticketLoader, policyLoader);

        // execution
        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> new NodeLoaderRegistry(loaders));

        // verifications
        assertThat(exception.getMessage()).contains("Duplicate key class com.openframe.graphql.node.SupportTicket");
    }

    private void stubTicketLoader() {
        when(ticketLoader.type()).thenReturn(NodeType.TICKET);
        when(ticketLoader.nodeClass()).thenReturn(SupportTicket.class);
    }

    private void stubUrgentTicketLoader() {
        when(urgentTicketLoader.type()).thenReturn(NodeType.TICKET_NOTE);
        when(urgentTicketLoader.nodeClass()).thenReturn(UrgentTicket.class);
    }

    private NodeLoaderRegistry ticketRegistry() {
        List<NodeLoader<?>> loaders = List.of(ticketLoader);
        return new NodeLoaderRegistry(loaders);
    }

    static class UrgentTicket extends SupportTicket {

        UrgentTicket(String id, String title) {
            super(id, title);
        }
    }

    static class CriticalTicket extends UrgentTicket {

        CriticalTicket(String id, String title) {
            super(id, title);
        }
    }
}
