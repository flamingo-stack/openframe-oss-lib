package com.openframe.api.datafetcher;

import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.graphql.node.RelayNodeFinder;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.DataFetchingEnvironmentImpl;
import graphql.schema.GraphQLSchema;
import graphql.schema.idl.RuntimeWiring;
import graphql.schema.idl.SchemaGenerator;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeDataFetcherTest {

    private static final String MACHINE_GLOBAL_ID = "TWFjaGluZTptYWNoaW5lLTE";
    private static final String TICKET_GLOBAL_ID = "VGlja2V0OjY2NWYxYzJhYjNlNGQ1ZjZhN2I4YzlkMA";
    private static final String RAW_OBJECT_ID = "507f1f77bcf86cd799439011";
    private static final String INVALID_NODE_ID = "Invalid node id";
    private static final String MINIMAL_SDL = "type Query { placeholder: Boolean }";

    @Mock private RelayNodeFinder nodeFinder;
    @Mock private UserService userService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private NodeDataFetcher dataFetcher;

    private AuthPrincipal principal;
    private Machine machine;
    private GraphQLSchema schema;
    private DataFetchingEnvironment environment;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
        machine = new Machine();
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(MINIMAL_SDL);
        schema = new SchemaGenerator().makeExecutableSchema(typeRegistry, RuntimeWiring.MOCKED_WIRING);
        environment = DataFetchingEnvironmentImpl.newDataFetchingEnvironment().graphQLSchema(schema).build();
    }

    @Test
    void node_foundNode_answersIt() {
        // setup
        when(nodeFinder.findNode(principal, MACHINE_GLOBAL_ID, schema)).thenReturn(Optional.<Object>of(machine));

        // execution
        Object node = dataFetcher.node(MACHINE_GLOBAL_ID, principal, environment);

        // verifications
        assertThat(node).isSameAs(machine);
    }

    @Test
    void node_nodeNotFound_null() {
        // setup
        when(nodeFinder.findNode(principal, TICKET_GLOBAL_ID, schema)).thenReturn(Optional.empty());

        // execution
        Object node = dataFetcher.node(TICKET_GLOBAL_ID, principal, environment);

        // verifications
        assertThat(node).isNull();
    }

    @Test
    void node_invalidId_throwsInvalidRelayId() {
        // setup
        when(nodeFinder.findNode(principal, RAW_OBJECT_ID, schema)).thenThrow(new InvalidRelayIdException(INVALID_NODE_ID));

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.node(RAW_OBJECT_ID, principal, environment));

        // verifications
        assertThat(exception.getMessage()).isEqualTo(INVALID_NODE_ID);
    }

    @Test
    void nodes_failingId_nullSlotAndTheRestResolved() {
        // setup
        when(nodeFinder.findNode(principal, RAW_OBJECT_ID, schema)).thenThrow(new InvalidRelayIdException(INVALID_NODE_ID));
        when(nodeFinder.findNode(principal, MACHINE_GLOBAL_ID, schema)).thenReturn(Optional.<Object>of(machine));
        List<String> ids = List.of(RAW_OBJECT_ID, MACHINE_GLOBAL_ID);

        // execution
        List<Object> nodes = dataFetcher.nodes(ids, principal, environment);

        // verifications
        assertThat(nodes).containsExactly(null, machine);
    }

    @Test
    void nodes_nodeNotFound_nullSlot() {
        // setup
        when(nodeFinder.findNode(principal, TICKET_GLOBAL_ID, schema)).thenReturn(Optional.empty());
        List<String> ids = List.of(TICKET_GLOBAL_ID);

        // execution
        List<Object> nodes = dataFetcher.nodes(ids, principal, environment);

        // verifications
        assertThat(nodes).containsExactly((Object) null);
    }
}
