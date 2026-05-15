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
public class TicketLabel {
    private String id;
    private String key;
    private String description;
    private String color;
    private Instant createdAt;
    private String createdBy;
}
