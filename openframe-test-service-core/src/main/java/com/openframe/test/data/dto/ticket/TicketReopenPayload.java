package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Result of {@code requestTicketReopen}: the ticket id and the status kind the ticket went back to. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TicketReopenPayload {
    private String ticketId;
    private String targetStatusKind;
    private List<TicketUserError> userErrors;
}
