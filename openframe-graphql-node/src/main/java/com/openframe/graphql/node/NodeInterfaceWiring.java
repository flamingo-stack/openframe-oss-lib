package com.openframe.graphql.node;

import com.netflix.graphql.dgs.DgsCodeRegistry;
import com.netflix.graphql.dgs.DgsComponent;
import graphql.language.InterfaceTypeDefinition;
import graphql.schema.GraphQLCodeRegistry;
import graphql.schema.idl.TypeDefinitionRegistry;
import lombok.RequiredArgsConstructor;

@DgsComponent
@RequiredArgsConstructor
public class NodeInterfaceWiring {

    private static final String NODE_INTERFACE = "Node";

    private final NodeTypeResolver nodeTypeResolver;

    // Registered only when the schema declares Node: @DgsTypeResolver would fail startup on a schema without it.
    @DgsCodeRegistry
    public GraphQLCodeRegistry.Builder registerNodeTypeResolver(GraphQLCodeRegistry.Builder codeRegistry,
                                                               TypeDefinitionRegistry typeRegistry) {
        if (declaresNodeInterface(typeRegistry)) {
            codeRegistry.typeResolver(NODE_INTERFACE, nodeTypeResolver::resolveObjectType);
        }
        return codeRegistry;
    }

    private static boolean declaresNodeInterface(TypeDefinitionRegistry typeRegistry) {
        InterfaceTypeDefinition node = typeRegistry.getTypeOrNull(NODE_INTERFACE, InterfaceTypeDefinition.class);
        return node != null;
    }
}
