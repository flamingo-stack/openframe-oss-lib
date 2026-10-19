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
// Temporary attachment uploaded before ticket creation (Temp Upload Pattern); cleanup job removes orphaned files (> 24h old).
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
    // Storage path/key in S3 temp folder, format: temp/{tempId}/{fileName}
    private String storagePath;
    // User who initiated the upload
    private String uploadedBy;
    // Used for cleanup job; files older than 24 hours are considered orphaned
    @Indexed
    @CreatedDate
    private Instant createdAt;
}
