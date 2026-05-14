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
public class TicketNote {
    private String id;
    private String ticketId;
    private String content;
    private String authorId;
    private TicketUser author;
    private TicketImage authorImage;
    private Instant createdAt;
    private Instant updatedAt;
}
