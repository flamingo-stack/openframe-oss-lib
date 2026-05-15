package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketAttachment {
    private String id;
    private String ticketId;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private Instant uploadedAt;
    private String uploadedBy;
}
