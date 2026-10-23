package com.openframe.graphql.node;

import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.GraphQLSchema;
import lombok.RequiredArgsConstructor;

import java.util.Optional;

@RequiredArgsConstructor
public class RelayNodeFinder {

    private static final String INVALID_NODE_ID = "Invalid node id";
    private static final String UNSUPPORTED_NODE_TYPE = "Unsupported node type: ";

    private final RelayIdCodec relayIdCodec;
    private final NodeLoaderRegistry registry;
    private final EntityStubDetector stubDetector;

    public Optional<Object> findNode(AuthPrincipal principal, String id, GraphQLSchema schema) {
        ParsedRelayId globalId = parseNodeId(id);
        String typeName = globalId.getTypeName();
        NodeType type = NodeType.fromTypeName(typeName);
        if (!isResolvable(type, schema)) {
            throw new IllegalArgumentException(UNSUPPORTED_NODE_TYPE + typeName);
        }
        String rawId = globalId.getRawId();
        return findResolvableNode(principal, type, rawId);
    }

    public Optional<Object> findNodeIfResolvable(AuthPrincipal principal, String id, GraphQLSchema schema) {
        return relayIdCodec.parse(id)
                .flatMap(globalId -> findParsedNodeIfResolvable(principal, globalId, schema));
    }

    private ParsedRelayId parseNodeId(String id) {
        return relayIdCodec.parse(id)
                .orElseThrow(() -> new InvalidRelayIdException(INVALID_NODE_ID));
    }

    private Optional<Object> findParsedNodeIfResolvable(AuthPrincipal principal, ParsedRelayId globalId,
                                                        GraphQLSchema schema) {
        String typeName = globalId.getTypeName();
        String rawId = globalId.getRawId();
        return NodeType.findByTypeName(typeName)
                .filter(type -> isResolvable(type, schema))
                .flatMap(type -> findResolvableNode(principal, type, rawId));
    }

    private boolean isResolvable(NodeType type, GraphQLSchema schema) {
        return registry.hasLoader(type) || stubDetector.isReferenceStub(schema, type);
    }

    private Optional<Object> findResolvableNode(AuthPrincipal principal, NodeType type, String rawId) {
        if (registry.hasLoader(type)) {
            return registry.find(principal, type, rawId);
        }
        String typeName = type.getGraphqlTypeName();
        FederatedNodeReference reference = new FederatedNodeReference(typeName, rawId);
        return Optional.of(reference);
    }
}
