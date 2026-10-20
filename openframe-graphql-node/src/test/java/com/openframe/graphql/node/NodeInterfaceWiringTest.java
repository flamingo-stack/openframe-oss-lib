package com.openframe.graphql.node;

import graphql.schema.GraphQLCodeRegistry;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class NodeInterfaceWiringTest {

    private static final String NODE_SDL = "type Query { node: Node } interface Node { id: ID! }";
    private static final String PLAIN_SDL = "type Query { placeholder: Boolean }";
    private static final String NODE_INTERFACE = "Node";

    @Mock private NodeTypeResolver nodeTypeResolver;

    @InjectMocks private NodeInterfaceWiring wiring;

    @Test
    void registerNodeTypeResolver_schemaWithNode_registersTheResolver() {
        // setup
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(NODE_SDL);
        GraphQLCodeRegistry.Builder codeRegistry = GraphQLCodeRegistry.newCodeRegistry();

        // execution
        GraphQLCodeRegistry.Builder registered = wiring.registerNodeTypeResolver(codeRegistry, typeRegistry);

        // verifications
        assertThat(registered.hasTypeResolver(NODE_INTERFACE)).isTrue();
    }

    @Test
    void registerNodeTypeResolver_schemaWithoutNode_registersNothing() {
        // setup
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(PLAIN_SDL);
        GraphQLCodeRegistry.Builder codeRegistry = GraphQLCodeRegistry.newCodeRegistry();

        // execution
        GraphQLCodeRegistry.Builder registered = wiring.registerNodeTypeResolver(codeRegistry, typeRegistry);

        // verifications
        assertThat(registered.hasTypeResolver(NODE_INTERFACE)).isFalse();
    }
}
