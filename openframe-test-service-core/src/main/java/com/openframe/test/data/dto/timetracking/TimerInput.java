package com.openframe.test.data.dto.timetracking;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload for {@code startTimer} and {@code stopTimer} ({@code StartTimerInput} / {@code StopTimerInput}
 * have the same shape). Ids are Relay global ids. A timer can start empty, but stopping it requires a
 * ticket or notes on the entry ("Either ticket or notes must be provided").
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TimerInput {
    private String ticketId;
    private String organizationId;
    private String notes;
}
