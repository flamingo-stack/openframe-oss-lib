package com.openframe.data.document.ticket;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One row of a ticket's status history: who moved the ticket, from which status to which, when,
 * and the reason they gave. Written on every status transition and never updated or deleted — the
 * ticket itself only knows its current status, this collection remembers the path.
 * <p>
 * Status kinds and names are stored as plain snapshots: history must survive statuses being
 * renamed or deleted and new kinds appearing, so nothing here references live definitions.
 */
@Document(collection = "ticket_status_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusHistory implements TenantScoped {

    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed
    private String ticketId;

    private String fromStatusId;
    private String fromStatusKind;
    private String fromStatusName;
    private String toStatusId;
    private String toStatusKind;
    private String toStatusName;

    private String actorId;
    private TicketActorType actorType;

    private String reason;

    @CreatedDate
    private Instant createdAt;
}
