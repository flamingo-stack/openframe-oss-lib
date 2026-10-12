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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ticket_attachments")
public class TicketAttachment implements TenantScoped {
    @Id
    private String id;
    @Indexed private String tenantId;

    @Indexed
    private String ticketId;

    private String fileName;

    private String contentType;

    private Long fileSize;

    private String storagePath;

    @CreatedDate
    private Instant uploadedAt;

    private String uploadedBy;
}
