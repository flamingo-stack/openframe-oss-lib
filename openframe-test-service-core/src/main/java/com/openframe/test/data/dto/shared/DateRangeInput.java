package com.openframe.test.data.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Half-open date range {@code [startDate, endDate)} in {@code yyyy-MM-dd}; the end day is excluded. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DateRangeInput {
    private String startDate;
    private String endDate;
}
