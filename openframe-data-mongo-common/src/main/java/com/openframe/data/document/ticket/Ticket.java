package com.openframe.data.document.ticket;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Primary ticket entity for PSA/Ticketing functionality.
 * Owns all metadata; Dialog becomes a simplified child.
 *
 * Tags are stored via unified TagAssignment (shared tag system).
 * Attachments are stored in TicketAttachment collection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tickets")
@CompoundIndexes({
        // TODO(lifecycle-rollout): drop legacy status_order index after `status` field removal
        @CompoundIndex(name = "status_order", def = "{'status': 1, 'order': 1}"),
        @CompoundIndex(name = "status_kind", def = "{'statusKind': 1}"),
        @CompoundIndex(name = "status_id_order", def = "{'statusId': 1, 'order': 1}")
})
public class Ticket {
    @Id
    private String id;

    @Indexed(unique = true)
    private Integer ticketNumber;

    private String title;

    private String description;

    // TODO(lifecycle-rollout): drop legacy status field once all reads/writes use statusKind/statusId
    private TicketStatus status;

    private String statusId;

    private TicketStatusKind statusKind;

    private boolean aiDisabled;

    private TicketCreationSource creationSource;

    private TicketOwner owner;

    @Indexed
    private String deviceId;
    private String deviceHostname;

    @Indexed
    private String organizationId;
    private String organizationName;

    private String reporterId;
    private String reporterName;

    @Indexed
    private String assignedTo;
    private String assignedName;

    private String order;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant resolvedAt;
}
