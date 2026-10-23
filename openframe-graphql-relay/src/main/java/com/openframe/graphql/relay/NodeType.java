package com.openframe.graphql.relay;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;
import java.util.Optional;

@Getter
@AllArgsConstructor
public enum NodeType {
    MACHINE("Machine", "machineId"),
    ORGANIZATION("Organization", "organizationId"),
    INTEGRATED_TOOL("IntegratedTool", "id"),
    TENANT("Tenant", "id"),
    DIALOG("Dialog", "id"),
    MESSAGE("Message", "id"),
    TAG("Tag", "id"),
    TOOL_CONNECTION("ToolConnection", "id"),
    INSTALLED_AGENT("InstalledAgent", "id"),
    LOG_EVENT("LogEvent", "id"),
    LOG_DETAILS("LogDetails", "id"),
    SCRIPT("Script", "id"),
    SCRIPT_EXECUTION("ScriptExecution", "id"),
    SCRIPT_SCHEDULE("ScriptSchedule", "id"),
    SCHEDULE_RUN("ScheduleRun", "id"),
    SOFTWARE_BUNDLE("SoftwareBundle", "id"),
    TICKET("Ticket", "id"),
    TICKET_NOTE("TicketNote", "id"),
    TICKET_ATTACHMENT("TicketAttachment", "id"),
    TICKET_STATUS_DEFINITION("TicketStatusDefinition", "id"),
    USER("User", "id"),
    KNOWLEDGE_BASE_ITEM("KnowledgeBaseItem", "id"),
    INSIGHT("Insight", "id"),
    ITEM_ASSIGNMENT("ItemAssignment", "id"),
    TIME_ENTRY("TimeEntry", "id"),
    NOTIFICATION("Notification", "id"),
    SOFTWARE_SCHEDULE("SoftwareSchedule", "id"),
    GUARDRAIL_POLICY("GuardrailPolicy", "id");

    private static final String UNKNOWN_NODE_TYPE = "Unknown Node type: ";

    private final String graphqlTypeName;
    private final String rawIdProperty;

    public static Optional<NodeType> findByTypeName(String typeName) {
        return Arrays.stream(values())
                .filter(type -> type.graphqlTypeName.equals(typeName))
                .findFirst();
    }

    public static NodeType fromTypeName(String typeName) {
        return findByTypeName(typeName)
                .orElseThrow(() -> new IllegalArgumentException(UNKNOWN_NODE_TYPE + typeName));
    }
}
