package com.openframe.graphql.node;

import com.netflix.graphql.dgs.exceptions.MissingDgsEntityFetcherException;
import com.netflix.graphql.dgs.exceptions.MissingFederatedQueryArgument;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeEntityFinderTest {

    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";
    private static final String MACHINE_ID = "machine-1";
    private static final String MACHINE_DOCUMENT_ID = "665f1c2ab3e4d5f6a7b8c9b2";
    private static final String TYPENAME = "__typename";
    private static final String KEY = "id";
    private static final String MACHINE_KEY = "machineId";

    @Mock private NodeLoaderRegistry registry;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private NodeEntityFinder finder;

    private final RelayIdCodec codec = new RelayIdCodec();

    private AuthPrincipal principal;
    private SupportTicket ticket;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("user-1").build();
        ticket = new SupportTicket(TICKET_ID, "Printer jam");
    }

    @Test
    void findEntity_rawKey_loadedByTheRawId() {
        // setup
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        when(registry.find(principal, NodeType.TICKET, TICKET_ID)).thenReturn(Optional.<Object>of(ticket));
        Map<String, Object> representation = Map.of(TYPENAME, "Ticket", KEY, TICKET_ID);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).containsSame(ticket);
    }

    @Test
    void findEntity_relayEncodedKey_loadedByTheRawId() {
        // setup
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        when(registry.find(principal, NodeType.TICKET, TICKET_ID)).thenReturn(Optional.<Object>of(ticket));
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        Map<String, Object> representation = Map.of(TYPENAME, "Ticket", KEY, ticketGlobalId);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).containsSame(ticket);
    }

    @Test
    void findEntity_machineKey_loadedByTheMachineIdNotTheDocumentId() {
        // setup
        when(registry.hasLoader(NodeType.MACHINE)).thenReturn(true);
        when(registry.find(principal, NodeType.MACHINE, MACHINE_ID)).thenReturn(Optional.<Object>of(ticket));
        Map<String, Object> representation = Map.of(TYPENAME, "Machine", MACHINE_KEY, MACHINE_ID, KEY, MACHINE_DOCUMENT_ID);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).containsSame(ticket);
    }

    @Test
    void findEntity_machineWithoutMachineId_emptyWithoutLookup() {
        // setup
        when(registry.hasLoader(NodeType.MACHINE)).thenReturn(true);
        Map<String, Object> representation = Map.of(TYPENAME, "Machine", KEY, MACHINE_DOCUMENT_ID);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).isEmpty();
        verify(registry, never()).find(eq(principal), eq(NodeType.MACHINE), anyString());
    }

    @Test
    void findEntity_foreignTypedKey_emptyWithoutLookup() {
        // setup
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        String dialogGlobalId = codec.encode(NodeType.DIALOG, TICKET_ID);
        Map<String, Object> representation = Map.of(TYPENAME, "Ticket", KEY, dialogGlobalId);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).isEmpty();
        verify(registry, never()).find(eq(principal), eq(NodeType.TICKET), anyString());
    }

    @ParameterizedTest
    @MethodSource("representationsWithoutStringKey")
    void findEntity_missingOrNonStringKey_emptyWithoutLookup(Map<String, Object> representation) {
        // setup
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).isEmpty();
        verify(registry, never()).find(eq(principal), eq(NodeType.TICKET), anyString());
    }

    @Test
    void findEntity_noTypename_throwsMissingFederatedQueryArgument() {
        // setup
        Map<String, Object> representation = Map.of(KEY, TICKET_ID);

        // execution
        MissingFederatedQueryArgument exception = assertThrows(MissingFederatedQueryArgument.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("The federated query is missing field(s) __typename");
        verifyNoInteractions(registry);
    }

    @Test
    void findEntity_typeWithoutLoader_throwsMissingEntityFetcher() {
        // setup
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        Map<String, Object> representation = Map.of(TYPENAME, "Dialog", KEY, TICKET_ID);

        // execution
        MissingDgsEntityFetcherException exception = assertThrows(MissingDgsEntityFetcherException.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Missing @DgsEntityFetcher for type Dialog");
    }

    @Test
    void findEntity_typenameOutsideNodeType_throwsMissingEntityFetcher() {
        // setup
        Map<String, Object> representation = Map.of(TYPENAME, "Foo", KEY, TICKET_ID);

        // execution
        MissingDgsEntityFetcherException exception = assertThrows(MissingDgsEntityFetcherException.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Missing @DgsEntityFetcher for type Foo");
        verifyNoInteractions(registry);
    }

    private static Stream<Arguments> representationsWithoutStringKey() {
        Map<String, Object> nullKey = new HashMap<>();
        nullKey.put(TYPENAME, "Ticket");
        nullKey.put(KEY, null);
        return Stream.of(
                Arguments.of(Map.of(TYPENAME, "Ticket")),
                Arguments.of(nullKey),
                Arguments.of(Map.of(TYPENAME, "Ticket", KEY, 42)));
    }
}
