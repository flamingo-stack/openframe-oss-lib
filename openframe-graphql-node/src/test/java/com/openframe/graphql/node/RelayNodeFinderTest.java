package com.openframe.graphql.node;

import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RelayNodeFinderTest {

    private static final String TICKET_ID = "665f1c2ab3e4d5f6a7b8c9d0";
    private static final String DIALOG_ID = "665f1c2ab3e4d5f6a7b8c9e1";
    private static final String RAW_OBJECT_ID = "507f1f77bcf86cd799439011";
    // base64url("Foo:1"): a well-formed global id whose type is not a NodeType
    private static final String UNKNOWN_TYPE_GLOBAL_ID = "Rm9vOjE";
    private static final String MINIMAL_SDL = "type Query { placeholder: Boolean }";

    @Mock private NodeLoaderRegistry registry;
    @Mock private EntityStubDetector stubDetector;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private RelayNodeFinder finder;

    private final RelayIdCodec codec = new RelayIdCodec();

    private AuthPrincipal principal;
    private SupportTicket ticket;
    private GraphQLSchema schema;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("user-1").build();
        ticket = new SupportTicket(TICKET_ID, "Printer jam");
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(MINIMAL_SDL);
        schema = new SchemaGenerator().makeExecutableSchema(typeRegistry, RuntimeWiring.MOCKED_WIRING);
    }

    @Test
    void findNode_typeWithLoader_nodeFromTheLoader() {
        // setup
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        when(registry.find(principal, NodeType.TICKET, TICKET_ID)).thenReturn(Optional.<Object>of(ticket));

        // execution
        Optional<Object> node = finder.findNode(principal, ticketGlobalId, schema);

        // verifications
        assertThat(node).containsSame(ticket);
    }

    @Test
    void findNode_loaderFindsNothing_empty() {
        // setup
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        when(registry.find(principal, NodeType.TICKET, TICKET_ID)).thenReturn(Optional.empty());

        // execution
        Optional<Object> node = finder.findNode(principal, ticketGlobalId, schema);

        // verifications
        assertThat(node).isEmpty();
    }

    @Test
    void findNode_referenceStub_referenceWithTheRawId() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        when(stubDetector.isReferenceStub(schema, NodeType.DIALOG)).thenReturn(true);

        // execution
        Optional<Object> node = finder.findNode(principal, dialogGlobalId, schema);

        // verifications
        assertThat(node).get()
                .isInstanceOf(FederatedNodeReference.class)
                .extracting("typeName", "id")
                .containsExactly("Dialog", DIALOG_ID);
        verify(registry, never()).find(eq(principal), eq(NodeType.DIALOG), anyString());
    }

    @Test
    void findNode_typeWithoutLoaderOrStub_throwsUnsupportedNodeType() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        when(stubDetector.isReferenceStub(schema, NodeType.DIALOG)).thenReturn(false);

        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> finder.findNode(principal, dialogGlobalId, schema));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Unsupported node type: Dialog");
    }

    @Test
    void findNode_typeNameOutsideNodeType_throwsUnknownNodeType() {
        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> finder.findNode(principal, UNKNOWN_TYPE_GLOBAL_ID, schema));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Unknown Node type: Foo");
        verifyNoInteractions(registry, stubDetector);
    }

    @ParameterizedTest
    @ValueSource(strings = {RAW_OBJECT_ID, "machine-1"})
    void findNode_rawId_throwsInvalidNodeId(String rawId) {
        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> finder.findNode(principal, rawId, schema));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Invalid node id");
        verifyNoInteractions(registry, stubDetector);
    }

    @Test
    void findNodeIfResolvable_typeWithLoader_nodeFromTheLoader() {
        // setup
        String ticketGlobalId = codec.encode(NodeType.TICKET, TICKET_ID);
        when(registry.hasLoader(NodeType.TICKET)).thenReturn(true);
        when(registry.find(principal, NodeType.TICKET, TICKET_ID)).thenReturn(Optional.<Object>of(ticket));

        // execution
        Optional<Object> node = finder.findNodeIfResolvable(principal, ticketGlobalId, schema);

        // verifications
        assertThat(node).containsSame(ticket);
    }

    @Test
    void findNodeIfResolvable_referenceStub_reference() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        when(stubDetector.isReferenceStub(schema, NodeType.DIALOG)).thenReturn(true);

        // execution
        Optional<Object> node = finder.findNodeIfResolvable(principal, dialogGlobalId, schema);

        // verifications
        assertThat(node).get()
                .isInstanceOf(FederatedNodeReference.class)
                .extracting("typeName", "id")
                .containsExactly("Dialog", DIALOG_ID);
    }

    @Test
    void findNodeIfResolvable_typeWithoutLoaderOrStub_emptyWithoutLookup() {
        // setup
        String dialogGlobalId = codec.encode(NodeType.DIALOG, DIALOG_ID);
        when(registry.hasLoader(NodeType.DIALOG)).thenReturn(false);
        when(stubDetector.isReferenceStub(schema, NodeType.DIALOG)).thenReturn(false);

        // execution
        Optional<Object> node = finder.findNodeIfResolvable(principal, dialogGlobalId, schema);

        // verifications
        assertThat(node).isEmpty();
        verify(registry, never()).find(eq(principal), eq(NodeType.DIALOG), anyString());
    }

    @Test
    void findNodeIfResolvable_typeNameOutsideNodeType_empty() {
        // execution
        Optional<Object> node = finder.findNodeIfResolvable(principal, UNKNOWN_TYPE_GLOBAL_ID, schema);

        // verifications
        assertThat(node).isEmpty();
        verifyNoInteractions(registry, stubDetector);
    }

    @ParameterizedTest
    @ValueSource(strings = {RAW_OBJECT_ID, "garbage"})
    void findNodeIfResolvable_rawId_empty(String rawId) {
        // execution
        Optional<Object> node = finder.findNodeIfResolvable(principal, rawId, schema);

        // verifications
        assertThat(node).isEmpty();
        verifyNoInteractions(registry, stubDetector);
    }
}
