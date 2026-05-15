package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketOwner {
    private String type;
    private String machineId;
    private TicketMachine machine;
    private String userId;
    private TicketUser user;
}
