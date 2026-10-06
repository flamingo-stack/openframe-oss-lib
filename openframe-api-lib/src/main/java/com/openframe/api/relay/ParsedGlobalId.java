package com.openframe.api.relay;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ParsedGlobalId {

    private final String typeName;
    private final String rawId;

    public boolean isOfType(NodeType type) {
        String expected = type.getGraphqlTypeName();
        return expected.equals(typeName);
    }
}
