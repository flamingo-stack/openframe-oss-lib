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
        @CompoundIndex(name = "status_kind", def = "{'statusKind': 1}"),
        @CompoundIndex(name = "status_id_order", def = "{'statusId': 1, 'order': 1}")
})
public class Ticket implements TenantScoped {
    @Id
    private String id;
    private String tenantId;
    private Integer ticketNumber;
    private String title;
    private String description;
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
    private String order;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    private Instant resolvedAt;
    public boolean isAiDisabled() {
        return statusKind != null && statusKind != TicketStatusKind.AI_ASSISTANCE;
    }
}
