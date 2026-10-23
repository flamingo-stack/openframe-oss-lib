package com.openframe.graphql.node;

import lombok.AllArgsConstructor;
import lombok.Getter;

// node(id) answer for a type another subgraph owns: the router completes it there through _entities.
@Getter
@AllArgsConstructor
public class FederatedNodeReference {

    private final String typeName;
    private final String id;
}
