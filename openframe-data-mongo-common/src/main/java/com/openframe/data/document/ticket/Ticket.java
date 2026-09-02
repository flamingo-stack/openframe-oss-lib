package com.openframe.data.document.ticket;
import com.openframe.data.document.TenantScoped;
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
        @CompoundIndex(name = "tenant_ticketNumber_idx", def = "{'tenantId':1,'ticketNumber':1}", unique = true),
        // TODO(lifecycle-rollout): drop legacy status_order index after `status` field removal
        @CompoundIndex(name = "status_order", def = "{'status': 1, 'order': 1}"),
        @CompoundIndex(name = "status_kind", def = "{'statusKind': 1}"),
        @CompoundIndex(name = "status_id_order", def = "{'statusId': 1, 'order': 1}"),
        // Board activity filter: per-column staleness scan. Never edit a live index def in place.
        @CompoundIndex(name = "tenant_status_activity", def = "{'tenantId': 1, 'statusId': 1, 'lastActivityAt': 1}")
})
public class Ticket implements TenantScoped {
    @Id
    private String id;
    private String tenantId;
    private Integer ticketNumber;
    private String title;
    private String description;
    // TODO(lifecycle-rollout): drop legacy status field once all reads/writes use statusKind/statusId
    private TicketStatus status;
    private String statusId;
    private TicketStatusKind statusKind;
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
    private Boolean escalatedByUser;
    private String order;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    private Instant resolvedAt;
    /**
     * Most recent chat action by any actor (end user, AI agent, technician) plus status moves.
     * The canonical staleness input, and deliberately separate from {@code updatedAt}: that field
     * means "the ticket record changed" and clients read it as the status move, so activity is
     * always stamped with a targeted update rather than a full save.
     * Null on tickets predating the field — read it as {@code createdAt}.
     */
    private Instant lastActivityAt;
    /**
     * Set when our side (AI or technician) sends a message, cleared when the client answers.
     * Non-null means the ticket is waiting on the client, so quiet does not read as stalled.
     */
    private Instant awaitingClientSince;
    private TicketResolver resolvedBy;
    private String resolvedById;
    private String resolvedByName;
    private Integer reopenCount;
    /** Activity falls back to creation time for tickets that predate activity tracking. */
    public Instant effectiveLastActivityAt() {
        return lastActivityAt != null ? lastActivityAt : createdAt;
    }

    public boolean isAiDisabled() {
        return statusKind != null && statusKind != TicketStatusKind.AI_ASSISTANCE;
    }
}
