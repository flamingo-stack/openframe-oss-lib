package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

public class NodeLoaderRegistry {

    private final Map<NodeType, NodeLoader<?>> loadersByType;
    private final Map<Class<?>, String> typeNamesByNodeClass;

    public NodeLoaderRegistry(List<NodeLoader<?>> loaders) {
        this.loadersByType = loaders.stream()
                .collect(Collectors.toUnmodifiableMap(NodeLoaderRegistry::typeOf, Function.identity()));
        this.typeNamesByNodeClass = loaders.stream()
                .collect(Collectors.toUnmodifiableMap(NodeLoaderRegistry::nodeClassOf, NodeLoaderRegistry::typeNameOf));
    }

    public boolean hasLoader(NodeType type) {
        return loadersByType.containsKey(type);
    }

    public Optional<Object> find(AuthPrincipal principal, NodeType type, String rawId) {
        if (!hasText(rawId)) {
            return Optional.empty();
        }
        return findLoader(type)
                .flatMap(loader -> findNode(loader, principal, rawId));
    }

    public Optional<String> findTypeName(Object node) {
        Class<?> nodeClass = node.getClass();
        String exactTypeName = typeNamesByNodeClass.get(nodeClass);
        return Optional.ofNullable(exactTypeName)
                .or(() -> findAssignableTypeName(node));
    }

    private Optional<NodeLoader<?>> findLoader(NodeType type) {
        NodeLoader<?> loader = loadersByType.get(type);
        return Optional.ofNullable(loader);
    }

    // A subclass (e.g. a @SuperBuilder document) answers the type of the loader whose class it extends.
    private Optional<String> findAssignableTypeName(Object node) {
        return loadersByType.values().stream()
                .filter(loader -> isNodeOf(loader, node))
                .map(NodeLoaderRegistry::typeNameOf)
                .findFirst();
    }

    private static Optional<Object> findNode(NodeLoader<?> loader, AuthPrincipal principal, String rawId) {
        Optional<?> node = loader.find(principal, rawId);
        return node.map(Object.class::cast);
    }

    private static boolean isNodeOf(NodeLoader<?> loader, Object node) {
        Class<?> nodeClass = loader.nodeClass();
        return nodeClass.isInstance(node);
    }

    private static NodeType typeOf(NodeLoader<?> loader) {
        return loader.type();
    }

    private static Class<?> nodeClassOf(NodeLoader<?> loader) {
        return loader.nodeClass();
    }

    private static String typeNameOf(NodeLoader<?> loader) {
        NodeType type = loader.type();
        return type.getGraphqlTypeName();
    }
}
