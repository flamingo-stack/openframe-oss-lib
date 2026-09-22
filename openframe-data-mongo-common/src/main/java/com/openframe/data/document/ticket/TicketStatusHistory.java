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

// Snapshots statuses by id/kind/name rather than referencing live definitions, since history must survive status renames/deletions.
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
