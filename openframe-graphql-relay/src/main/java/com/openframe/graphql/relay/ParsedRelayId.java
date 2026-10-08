package com.openframe.graphql.relay;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ParsedRelayId {

    private final String typeName;
    private final String rawId;

    public boolean isOfType(NodeType type) {
        String expected = type.getGraphqlTypeName();
        return expected.equals(typeName);
    }
}
