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
public class ReorderTicketStatusInput {
    @NotBlank
    private String id;
    private String afterStatusId;
    private String beforeStatusId;
}
