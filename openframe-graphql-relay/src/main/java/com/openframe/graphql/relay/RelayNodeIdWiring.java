package com.openframe.graphql.relay;

import com.netflix.graphql.dgs.DgsCodeRegistry;
import com.netflix.graphql.dgs.DgsComponent;
import graphql.language.ObjectTypeDefinition;
import graphql.language.Type;
import graphql.language.TypeName;
import graphql.schema.DataFetcher;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.FieldCoordinates;
import graphql.schema.GraphQLCodeRegistry;
import graphql.schema.PropertyDataFetcher;
import graphql.schema.idl.TypeDefinitionRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class RelayNodeIdWiring {

    private static final String NODE_INTERFACE = "Node";
    private static final String ID_FIELD = "id";

    private final RelayIdCodec relayIdCodec;
    private final RelayIdEncodingPolicy encodingPolicy;

    @DgsCodeRegistry
    public GraphQLCodeRegistry.Builder registerNodeIds(GraphQLCodeRegistry.Builder codeRegistry,
                                                       TypeDefinitionRegistry typeRegistry) {
        Set<String> nodeTypeNames = findNodeTypeNames(typeRegistry);
        nodeTypeNames.stream()
                .map(NodeType::fromTypeName)
                .forEach(nodeType -> registerNodeId(codeRegistry, nodeType));
        log.debug("Relay global ids wired for Node types {}", nodeTypeNames);
        return codeRegistry;
    }

    private static Set<String> findNodeTypeNames(TypeDefinitionRegistry typeRegistry) {
        List<ObjectTypeDefinition> definitions = typeRegistry.getTypes(ObjectTypeDefinition.class);
        Stream<ObjectTypeDefinition> extensions = typeRegistry.objectTypeExtensions().values().stream()
                .flatMap(Collection::stream);
        return Stream.concat(definitions.stream(), extensions)
                .filter(RelayNodeIdWiring::implementsNode)
                .map(ObjectTypeDefinition::getName)
                .collect(Collectors.toSet());
    }

    private static boolean implementsNode(ObjectTypeDefinition definition) {
        List<Type> interfaces = definition.getImplements();
        return interfaces.stream().anyMatch(RelayNodeIdWiring::isNodeInterface);
    }

    private static boolean isNodeInterface(Type type) {
        return type instanceof TypeName typeName && NODE_INTERFACE.equals(typeName.getName());
    }

    // An explicit @DgsData on Type.id is registered before this runs and wins, e.g. an id kept raw on purpose.
    private void registerNodeId(GraphQLCodeRegistry.Builder codeRegistry, NodeType nodeType) {
        String typeName = nodeType.getGraphqlTypeName();
        FieldCoordinates nodeId = FieldCoordinates.coordinates(typeName, ID_FIELD);
        if (codeRegistry.hasDataFetcher(nodeId)) {
            return;
        }
        DataFetcher<Object> nodeIdFetcher = nodeIdFetcher(nodeType);
        codeRegistry.dataFetcher(nodeId, nodeIdFetcher);
    }

    private DataFetcher<Object> nodeIdFetcher(NodeType nodeType) {
        String rawIdProperty = nodeType.getRawIdProperty();
        PropertyDataFetcher<Object> rawIdFetcher = PropertyDataFetcher.fetching(rawIdProperty);
        PropertyDataFetcher<Object> plainIdFetcher = PropertyDataFetcher.fetching(ID_FIELD);
        return environment -> resolveNodeId(nodeType, rawIdFetcher, plainIdFetcher, environment);
    }

    // A declined request gets the id property unchanged, the value the field had before Relay.
    private Object resolveNodeId(NodeType nodeType, PropertyDataFetcher<Object> rawIdFetcher,
                                 PropertyDataFetcher<Object> plainIdFetcher, DataFetchingEnvironment environment) {
        if (!encodingPolicy.shouldEncode(environment)) {
            return plainIdFetcher.get(environment);
        }
        return encodeGlobalId(nodeType, rawIdFetcher, environment);
    }

    private String encodeGlobalId(NodeType nodeType, PropertyDataFetcher<Object> rawIdFetcher,
                                  DataFetchingEnvironment environment) {
        Object rawIdValue = rawIdFetcher.get(environment);
        String rawId = String.valueOf(rawIdValue);
        return relayIdCodec.encode(nodeType, rawId);
    }
}
