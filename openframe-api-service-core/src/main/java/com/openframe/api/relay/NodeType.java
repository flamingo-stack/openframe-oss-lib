package com.openframe.api.relay;

public enum NodeType {
    MACHINE("Machine"),
    ORGANIZATION("Organization"),
    EVENT("Event"),
    INTEGRATED_TOOL("IntegratedTool"),
    TENANT("Tenant");

    private final String graphqlTypeName;

    NodeType(String graphqlTypeName) {
        this.graphqlTypeName = graphqlTypeName;
    }

    public String getGraphqlTypeName() {
        return graphqlTypeName;
    }

    public static NodeType fromTypeName(String typeName) {
        for (NodeType type : values()) {
            if (type.graphqlTypeName.equals(typeName)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown Node type: " + typeName);
    }
}
