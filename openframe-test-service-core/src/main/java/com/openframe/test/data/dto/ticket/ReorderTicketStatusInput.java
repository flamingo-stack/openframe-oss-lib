package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Moves a status definition after or before another one in the board order. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReorderTicketStatusInput {
    private String id;
    private String afterStatusId;
    private String beforeStatusId;
}
