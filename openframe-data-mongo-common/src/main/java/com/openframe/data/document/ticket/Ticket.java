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
        @CompoundIndex(name = "status_created", def = "{'status': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "assignee_status", def = "{'assignedTo': 1, 'status': 1}"),
        @CompoundIndex(name = "organization_status", def = "{'organizationId': 1, 'status': 1}"),
        @CompoundIndex(name = "device_status", def = "{'deviceId': 1, 'status': 1}"),
        @CompoundIndex(name = "tenant_status_kind_created",
                def = "{'tenantId': 1, 'statusKind': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "tenant_assignee_status_kind",
                def = "{'tenantId': 1, 'assignedTo': 1, 'statusKind': 1}"),
        @CompoundIndex(name = "tenant_org_status_kind",
                def = "{'tenantId': 1, 'organizationId': 1, 'statusKind': 1}"),
        @CompoundIndex(name = "tenant_device_status_kind",
                def = "{'tenantId': 1, 'deviceId': 1, 'statusKind': 1}"),
        @CompoundIndex(name = "tenant_status_id",
                def = "{'tenantId': 1, 'statusId': 1}")
})
public class Ticket {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    @Indexed(unique = true)
    private Integer ticketNumber;

    private String title;

    private String description;

    @Indexed
    private TicketStatus status;

    @Indexed
    private String statusId;

    @Indexed
    private TicketStatusKind statusKind;

    private boolean aiDisabled;

    @Indexed
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

    @Indexed
    private String order;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant resolvedAt;
}
