package com.openframe.graphql.node;

import graphql.TypeResolutionEnvironment;
import graphql.schema.GraphQLObjectType;
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
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeTypeResolverTest {

    private static final String SCHEMA_SDL = """
            type Query { node: Node }
            interface Node { id: ID! }
            type Ticket implements Node { id: ID! }
            """;

    @Mock private NodeLoaderRegistry registry;
    @Mock private TypeResolutionEnvironment environment;

    @InjectMocks private NodeTypeResolver resolver;

    private SupportTicket ticket;
    private GraphQLSchema schema;

    @BeforeEach
    void setUp() {
        ticket = new SupportTicket("ticket-1", "Printer jam");
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(SCHEMA_SDL);
        schema = new SchemaGenerator().makeExecutableSchema(typeRegistry, RuntimeWiring.MOCKED_WIRING);
    }

    @Test
    void resolveTypeName_federatedReference_itsTypeName() {
        // setup
        FederatedNodeReference reference = new FederatedNodeReference("Dialog", "dialog-1");

        // execution
        String typeName = resolver.resolveTypeName(reference);

        // verifications
        assertThat(typeName).isEqualTo("Dialog");
        verifyNoInteractions(registry);
    }

    @Test
    void resolveTypeName_loaderNode_theRegistryTypeName() {
        // setup
        when(registry.findTypeName(ticket)).thenReturn(Optional.of("Ticket"));

        // execution
        String typeName = resolver.resolveTypeName(ticket);

        // verifications
        assertThat(typeName).isEqualTo("Ticket");
    }

    @Test
    void resolveTypeName_objectOfNoLoaderClass_throwsUnknownNodeType() {
        // setup
        Object unknown = "not a node";
        when(registry.findTypeName(unknown)).thenReturn(Optional.empty());

        // execution
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> resolver.resolveTypeName(unknown));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Unknown Node type: java.lang.String");
    }

    @Test
    void resolveObjectType_loaderNode_theSchemaObjectType() {
        // setup
        when(environment.<Object>getObject()).thenReturn(ticket);
        when(environment.getSchema()).thenReturn(schema);
        when(registry.findTypeName(ticket)).thenReturn(Optional.of("Ticket"));
        GraphQLObjectType ticketType = schema.getObjectType("Ticket");

        // execution
        GraphQLObjectType resolved = resolver.resolveObjectType(environment);

        // verifications
        assertThat(resolved).isSameAs(ticketType);
    }
}
