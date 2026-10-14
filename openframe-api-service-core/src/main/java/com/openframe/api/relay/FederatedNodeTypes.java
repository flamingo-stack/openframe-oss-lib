package com.openframe.api.relay;

import com.openframe.graphql.relay.NodeType;

import java.util.Set;

// Node types another federation subgraph owns: node(id) answers them with a reference the router completes there.
public interface FederatedNodeTypes {

    Set<NodeType> types();
}
