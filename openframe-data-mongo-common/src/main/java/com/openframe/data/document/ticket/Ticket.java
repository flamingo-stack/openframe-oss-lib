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
import java.util.List;

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
    @CompoundIndex(name = "device_status", def = "{'deviceId': 1, 'status': 1}")
})
public class Ticket {
    @Id
    private String id;

    /**
     * Human-readable ticket number (e.g., 1001, 1002).
     * Auto-incremented per tenant.
     */
    @Indexed(unique = true)
    private Integer ticketNumber;

    private String title;

    /**
     * Rich text description (HTML from editor).
     */
    private String description;

    @Indexed
    private TicketStatus status;

    @Indexed
    private TicketCreationSource creationSource;

    private TicketOwner owner;

    /**
     * Device (Machine) that this ticket is about.
     */
    @Indexed
    private String deviceId;
    private String deviceHostname;

    /**
     * Organization the device belongs to.
     */
    @Indexed
    private String organizationId;
    private String organizationName;

    /**
     * Reporter - the end user (future: from Authentic).
     * For now, may be null until Authentic integration.
     */
    private String reporterId;
    private String reporterName;

    /**
     * Assigned technician (User from users collection).
     */
    @Indexed
    private String assignedTo;
    private String assignedName;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant resolvedAt;
}
