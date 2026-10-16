package com.openframe.graphql.node;

import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;
import java.util.Optional;

@RequiredArgsConstructor
@Slf4j
public class NodeEntityFinder {

    private static final String TYPENAME = "__typename";

    private final RelayIdCodec relayIdCodec;
    private final NodeLoaderRegistry registry;

    public Optional<Object> findEntity(AuthPrincipal principal, Map<String, Object> representation) {
        NodeType type = loadableTypeOf(representation);
        return keyOf(type, representation)
                .flatMap(key -> decodeKey(type, key))
                .flatMap(rawId -> registry.find(principal, type, rawId));
    }

    private NodeType loadableTypeOf(Map<String, Object> representation) {
        Object typeName = representation.get(TYPENAME);
        if (typeName == null) {
            throw UnresolvableRepresentationException.missingTypename();
        }
        String name = typeName.toString();
        return NodeType.findByTypeName(name)
                .filter(registry::hasLoader)
                .orElseThrow(() -> UnresolvableRepresentationException.noLoaderFor(name));
    }

    // The @key field is the type's raw id property (machineId for a Machine, whose id differs per subgraph; mostly id).
    private static Optional<String> keyOf(NodeType type, Map<String, Object> representation) {
        String keyField = type.getRawIdProperty();
        Object key = representation.get(keyField);
        return Optional.ofNullable(key)
                .filter(String.class::isInstance)
                .map(String.class::cast);
    }

    private Optional<String> decodeKey(NodeType type, String key) {
        try {
            String rawId = relayIdCodec.decode(key, type);
            return Optional.of(rawId);
        } catch (InvalidRelayIdException e) {
            log.debug("Entity key {} is not a {} id: {}", key, type.getGraphqlTypeName(), e.getMessage());
            return Optional.empty();
        }
    }
}
