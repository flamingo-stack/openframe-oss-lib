package com.openframe.external.dto.ticket;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ticket attachment metadata")
public class TicketAttachmentResponse {

    @Schema(description = "Attachment ID")
    private String id;

    @Schema(description = "Ticket ID")
    private String ticketId;

    @Schema(description = "Original file name")
    private String fileName;

    @Schema(description = "MIME type")
    private String contentType;

    @Schema(description = "File size in bytes")
    private Long fileSize;

    private Instant uploadedAt;

    @Schema(description = "Uploader user ID or machineId")
    private String uploadedBy;
}
