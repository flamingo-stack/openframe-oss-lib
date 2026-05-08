package com.openframe.api.relay;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsTypeResolver;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.user.User;
import com.openframe.data.document.event.Event;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tenant.Tenant;

@DgsComponent
public class NodeTypeResolver {

    @DgsTypeResolver(name = "Node")
    public String resolveNode(Object node) {
        if (node instanceof Machine) {
            return "Machine";
        }
        if (node instanceof Organization) {
            return "Organization";
        }
        if (node instanceof Event) {
            return "Event";
        }
        if (node instanceof IntegratedTool) {
            return "IntegratedTool";
        }
        if (node instanceof Tenant) {
            return "Tenant";
        }
        if (node instanceof ItemAssignment) {
            return "ItemAssignment";
        }
        if (node instanceof Ticket) {
            return "Ticket";
        }
        if (node instanceof KnowledgeBaseItem) {
            return "KnowledgeBaseItem";
        }
        if (node instanceof User) {
            return "User";
        }
        throw new IllegalArgumentException("Unknown Node type: " + node.getClass().getName());
    }
}
