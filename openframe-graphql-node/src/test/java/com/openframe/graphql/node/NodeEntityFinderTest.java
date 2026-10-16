package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
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
    private static final String PROPERTY_KEY_VALUE = "key-1";
    private static final String DOCUMENT_ID = "665f1c2ab3e4d5f6a7b8c9b2";
    private static final String TYPENAME = "__typename";
    private static final String KEY = "id";

    @Mock private NodeLoaderRegistry registry;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private NodeEntityFinder finder;

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
        String ticketGlobalId = relayIdCodec.encode(NodeType.TICKET, TICKET_ID);
        Map<String, Object> representation = Map.of(TYPENAME, "Ticket", KEY, ticketGlobalId);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).containsSame(ticket);
    }

    @ParameterizedTest
    @CsvSource({"MACHINE, Machine, machineId", "ORGANIZATION, Organization, organizationId"})
    void findEntity_typeWithOwnKeyProperty_loadedByThatPropertyNotTheDocumentId(NodeType type, String typeName,
                                                                                String keyProperty) {
        // setup
        when(registry.hasLoader(type)).thenReturn(true);
        when(registry.find(principal, type, PROPERTY_KEY_VALUE)).thenReturn(Optional.<Object>of(ticket));
        Map<String, Object> representation = Map.of(TYPENAME, typeName, keyProperty, PROPERTY_KEY_VALUE, KEY, DOCUMENT_ID);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).containsSame(ticket);
    }

    @ParameterizedTest
    @CsvSource({"MACHINE, Machine", "ORGANIZATION, Organization"})
    void findEntity_typeWithOwnKeyPropertyButOnlyId_emptyWithoutLookup(NodeType type, String typeName) {
        // setup
        when(registry.hasLoader(type)).thenReturn(true);
        Map<String, Object> representation = Map.of(TYPENAME, typeName, KEY, DOCUMENT_ID);

        // execution
        Optional<Object> entity = finder.findEntity(principal, representation);

        // verifications
        assertThat(entity).isEmpty();
        verify(registry, never()).find(eq(principal), eq(type), anyString());
    }

    @Test
    void findEntity_foreignTypedKey_emptyWithoutLookup() {
        // setup
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        String dialogGlobalId = relayIdCodec.encode(NodeType.DIALOG, TICKET_ID);
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
    void findEntity_noTypename_throwsUnresolvableRepresentation() {
        // setup
        Map<String, Object> representation = Map.of(KEY, TICKET_ID);

        // execution
        UnresolvableRepresentationException exception = assertThrows(UnresolvableRepresentationException.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Representation has no __typename");
        verifyNoInteractions(registry);
    }

    @Test
    void findEntity_typeWithoutLoader_throwsUnresolvableRepresentation() {
        // setup
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        Map<String, Object> representation = Map.of(TYPENAME, "Dialog", KEY, TICKET_ID);

        // execution
        UnresolvableRepresentationException exception = assertThrows(UnresolvableRepresentationException.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("No node loader for type Dialog");
    }

    @Test
    void findEntity_typenameOutsideNodeType_throwsUnresolvableRepresentation() {
        // setup
        Map<String, Object> representation = Map.of(TYPENAME, "Foo", KEY, TICKET_ID);

        // execution
        UnresolvableRepresentationException exception = assertThrows(UnresolvableRepresentationException.class,
                () -> finder.findEntity(principal, representation));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("No node loader for type Foo");
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
