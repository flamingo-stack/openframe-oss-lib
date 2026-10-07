package com.openframe.graphql.relay;

import lombok.AllArgsConstructor;
import lombok.Getter;

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
    SOFTWARE_SCHEDULE("SoftwareSchedule", "id");

    private final String graphqlTypeName;
    private final String rawIdProperty;

    public static NodeType fromTypeName(String typeName) {
        for (NodeType type : values()) {
            if (type.graphqlTypeName.equals(typeName)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown Node type: " + typeName);
    }
}
