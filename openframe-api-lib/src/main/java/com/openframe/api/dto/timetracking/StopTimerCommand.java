package com.openframe.api.dto.timetracking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Command used to finalize an active timer.
 * If supplied, ticketId or notes override staging values that were stored during start/edit.
 * Final entry must satisfy the "ticket or notes required" invariant.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StopTimerCommand {
    private String ticketId;
    private String notes;
}
