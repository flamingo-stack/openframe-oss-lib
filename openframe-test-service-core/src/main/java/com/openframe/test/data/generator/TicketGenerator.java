package com.openframe.test.data.generator;

import com.openframe.test.data.dto.ticket.CreateTicketInput;
import com.openframe.test.data.dto.ticket.TicketFilterInput;

import java.util.List;

public class TicketGenerator {

    public static CreateTicketInput createTicketRequest(String organizationId,
                                                        String deviceId,
                                                        String assigneeId,
                                                        List<String> labelIds) {
        return CreateTicketInput.builder()
                .title("Test ticket")
                .description("Manually created ticket for tests")
                .organizationId(organizationId)
                .deviceId(deviceId)
                .assigneeId(assigneeId)
                .labelIds(labelIds)
                .build();
    }

    public static TicketFilterInput activeTickets() {
        return TicketFilterInput.builder()
                .statuses(List.of("ACTIVE"))
                .build();
    }
}
