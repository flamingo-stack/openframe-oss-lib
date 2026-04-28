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
 * Temporary attachment uploaded before ticket creation.
 * Part of the "Temp Upload Pattern" (like Gmail, Slack, GitHub).
 *
 * Flow:
 * 1. User uploads file → createTempAttachmentUploadUrl → TempAttachment created
 * 2. User saves ticket → files moved from temp/ to attachments/{ticketId}/
 * 3. TempAttachment deleted, TicketAttachment created
 *
 * Cleanup job runs every 6 hours to delete orphaned temp files (> 24h old).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "temp_attachments")
public class TempAttachment implements TenantScoped {
    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String fileName;

    private String contentType;

    private Long fileSize;

    /**
     * Storage path/key in S3 temp folder.
     * Format: temp/{tempId}/{fileName}
     */
    private String storagePath;

    /**
     * User who initiated the upload.
     */
    private String uploadedBy;

    /**
     * Creation time - used for cleanup job.
     * Files older than 24 hours are considered orphaned.
     */
    @Indexed
    @CreatedDate
    private Instant createdAt;
}
