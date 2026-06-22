package com.openframe.api.dto.timetracking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTimeEntryInput {

    @NotBlank
    private String userId;

    private String ticketId;
    private String notes;

    @NotNull
    private Instant startedAt;

    @Positive
    private long durationSeconds;
}
