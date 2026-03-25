package com.openframe.api.relay;

public enum NodeType {
    MACHINE("Machine"),
    ORGANIZATION("Organization"),
    EVENT("Event"),
    INTEGRATED_TOOL("IntegratedTool"),
    TENANT("Tenant"),
    DIALOG("Dialog"),
    MESSAGE("Message"),
    TAG("Tag"),
    TOOL_CONNECTION("ToolConnection"),
    INSTALLED_AGENT("InstalledAgent"),
    LOG_EVENT("LogEvent"),
    LOG_DETAILS("LogDetails");

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
