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
 * File attachment linked to a ticket.
 * Files are stored externally (S3/MinIO), this stores metadata.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_attachments")
public class TicketAttachment implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    @Indexed
    private String ticketId;

    private String fileName;

    private String contentType;

    private Long fileSize;

    /**
     * Storage path/key (e.g., S3 key or MinIO path).
     */
    private String storagePath;

    @CreatedDate
    private Instant uploadedAt;

    private String uploadedBy;
}
