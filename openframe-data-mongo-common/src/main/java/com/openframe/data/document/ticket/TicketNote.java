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
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
// Separate from Dialog/Messages: notes are simple editable/deletable text entries, not chat messages.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_notes")
@CompoundIndex(name = "ticket_created", def = "{'ticketId': 1, 'createdAt': -1}")
public class TicketNote implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed
    private String ticketId;
    private String content;
    // Author name resolved via DataLoader, not stored here.
    private String authorId;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
}

