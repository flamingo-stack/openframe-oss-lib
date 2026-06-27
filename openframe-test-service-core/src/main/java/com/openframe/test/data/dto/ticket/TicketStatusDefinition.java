package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketStatusDefinition {
    private String id;
    private String name;
    private String color;
    private String position;
    private String kind;
    @JsonProperty("isSystem")
    private boolean system;
    private String systemKey;
}
