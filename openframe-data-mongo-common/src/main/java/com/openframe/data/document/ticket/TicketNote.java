package com.openframe.data.document.ticket;

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

/**
 * Internal notes by technicians on a ticket.
 * Separate from Dialog/Messages - simple text entries.
 *
 * From design: shows author avatar, name, timestamp, and text content.
 * Notes can be edited and deleted.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_notes")
@CompoundIndex(name = "ticket_created", def = "{'ticketId': 1, 'createdAt': -1}")
public class TicketNote {
    @Id
    private String id;

    @Indexed
    private String ticketId;

    /**
     * Note content (plain text or markdown).
     */
    private String content;

    /**
     * Author - technician who created the note (User ID).
     * Author name resolved via DataLoader.
     */
    private String authorId;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
