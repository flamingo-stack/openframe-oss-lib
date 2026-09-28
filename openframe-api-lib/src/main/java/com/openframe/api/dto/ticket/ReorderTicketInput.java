package com.openframe.api.dto.ticket;

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
    /** Lifecycle column; absent means "same column". */
    private String statusId;
}
