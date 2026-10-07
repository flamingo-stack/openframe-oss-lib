package com.openframe.graphql.relay;

import graphql.schema.FieldCoordinates;
import graphql.schema.GraphQLCodeRegistry;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RelayNodeIdWiringTest {

    private static final String UNKNOWN_NODE_SCHEMA = """
            interface Node { id: ID! }
            type Widget implements Node { id: ID! }
            """;
    private static final String SCHEMA_WITHOUT_NODE = """
            type Script { id: ID! }
            """;

    private final RelayNodeIdWiring wiring = new RelayNodeIdWiring(new RelayIdCodec());

    @Test
    void registerNodeIds_nodeTypeUnknownToNodeType_failsTheSchema() {
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(UNKNOWN_NODE_SCHEMA);
        GraphQLCodeRegistry.Builder codeRegistry = GraphQLCodeRegistry.newCodeRegistry();

        assertThatThrownBy(() -> wiring.registerNodeIds(codeRegistry, typeRegistry))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Widget");
    }

    @Test
    void registerNodeIds_schemaWithoutNode_registersNothing() {
        TypeDefinitionRegistry typeRegistry = new SchemaParser().parse(SCHEMA_WITHOUT_NODE);
        GraphQLCodeRegistry.Builder codeRegistry = GraphQLCodeRegistry.newCodeRegistry();

        wiring.registerNodeIds(codeRegistry, typeRegistry);

        FieldCoordinates scriptId = FieldCoordinates.coordinates("Script", "id");
        assertThat(codeRegistry.hasDataFetcher(scriptId)).isFalse();
    }
}
