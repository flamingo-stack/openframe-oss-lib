package com.openframe.api.dto.timetracking;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DateRangeInput {

    @NotNull
    private LocalDate startDate;

    @NotNull
    private LocalDate endDate;
}
