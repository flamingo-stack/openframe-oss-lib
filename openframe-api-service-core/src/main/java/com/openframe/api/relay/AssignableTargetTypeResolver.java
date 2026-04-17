package com.openframe.api.relay;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsTypeResolver;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;

@DgsComponent
public class AssignableTargetTypeResolver {

    @DgsTypeResolver(name = "AssignableTarget")
    public String resolveAssignableTarget(Object target) {
        if (target instanceof Organization) return "Organization";
        if (target instanceof Machine) return "Machine";
        if (target instanceof Ticket) return "Ticket";
        throw new IllegalArgumentException("Unknown AssignableTarget type: " + target.getClass().getName());
    }
}
