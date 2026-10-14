package com.openframe.api.relay;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class FederatedNodeReference {

    private final String typeName;
    private final String id;
}
