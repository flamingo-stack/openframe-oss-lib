package com.openframe.graphql.node;

import graphql.TypeResolutionEnvironment;
import graphql.schema.GraphQLObjectType;
import graphql.schema.GraphQLSchema;
import lombok.RequiredArgsConstructor;

// One class -> type mapping for Node and _Entity; not a graphql TypeResolver bean, which DGS would take as its fallback.
@RequiredArgsConstructor
public class NodeTypeResolver {

    private static final String UNKNOWN_NODE_TYPE = "Unknown Node type: ";

    private final NodeLoaderRegistry registry;

    public GraphQLObjectType resolveObjectType(TypeResolutionEnvironment environment) {
        Object node = environment.getObject();
        String typeName = resolveTypeName(node);
        GraphQLSchema schema = environment.getSchema();
        return schema.getObjectType(typeName);
    }

    public String resolveTypeName(Object node) {
        if (node instanceof FederatedNodeReference reference) {
            return reference.getTypeName();
        }
        Class<?> nodeClass = node.getClass();
        String className = nodeClass.getName();
        return registry.findTypeName(node)
                .orElseThrow(() -> new IllegalArgumentException(UNKNOWN_NODE_TYPE + className));
    }
}
