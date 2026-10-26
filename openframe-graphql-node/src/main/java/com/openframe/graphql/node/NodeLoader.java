package com.openframe.graphql.node;

import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;

import java.util.Optional;

public interface NodeLoader<T> {

    NodeType type();

    Class<T> nodeClass();

    Optional<T> find(AuthPrincipal principal, String rawId);
}
