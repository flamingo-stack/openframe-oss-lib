package com.openframe.api.dto.ticket;

import com.openframe.data.document.ticket.TicketStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReorderTicketInput {
    @NotBlank
    private String id;
    private String afterTicketId;
    private String beforeTicketId;
    /** Legacy column (lifecycle feature OFF). */
    private TicketStatus status;
    /** Custom-status column (lifecycle feature ON). */
    private String statusId;
}
