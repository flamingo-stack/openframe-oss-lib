package com.openframe.api.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransitionTicketInput {

    @NotBlank
    private String ticketId;

    @NotBlank
    private String toStatusId;

    @Size(max = 500)
    private String reason;

    /**
     * The client's "what's still not working" text from the reopen modal. Only the client reopen
     * path sets it; admin transitions that happen to reopen a ticket carry none. Travels into the
     * REOPENED chat event and the reopen notification, never into the transition log.
     */
    @Size(max = 1000)
    private String reopenReason;
}
