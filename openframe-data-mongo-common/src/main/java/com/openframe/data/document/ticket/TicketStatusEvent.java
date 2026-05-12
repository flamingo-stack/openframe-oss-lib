package com.openframe.data.document.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_status_events")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_ticket_time",
                def = "{'tenantId': 1, 'ticketId': 1, 'occurredAt': -1}")
})
public class TicketStatusEvent {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String ticketId;

    private String fromStatusId;

    private TicketStatusKind fromKind;

    private String toStatusId;

    private TicketStatusKind toKind;

    private String actorType;

    private String actorId;

    private String reason;

    private Instant occurredAt;
}
