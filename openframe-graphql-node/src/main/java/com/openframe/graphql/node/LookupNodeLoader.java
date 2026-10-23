package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;

import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;

@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public final class LookupNodeLoader<T> implements NodeLoader<T> {

    private final NodeType type;
    private final Class<T> nodeClass;
    private final BiFunction<AuthPrincipal, String, Optional<T>> lookup;

    public static <T> LookupNodeLoader<T> byRawId(NodeType type, Class<T> nodeClass,
                                                  Function<String, Optional<T>> lookup) {
        BiFunction<AuthPrincipal, String, Optional<T>> rawIdLookup = (principal, rawId) -> lookup.apply(rawId);
        return new LookupNodeLoader<>(type, nodeClass, rawIdLookup);
    }

    public static <T> LookupNodeLoader<T> byPrincipalAndRawId(NodeType type, Class<T> nodeClass,
                                                              BiFunction<AuthPrincipal, String, Optional<T>> lookup) {
        return new LookupNodeLoader<>(type, nodeClass, lookup);
    }

    @Override
    public NodeType type() {
        return type;
    }

    @Override
    public Class<T> nodeClass() {
        return nodeClass;
    }

    @Override
    public Optional<T> find(AuthPrincipal principal, String rawId) {
        return lookup.apply(principal, rawId);
    }
}
