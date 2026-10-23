package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Filter for {@code scriptSchedules(...)} and {@code scriptScheduleFilters(...)}. All fields are
 * optional; {@code statuses} hides DELETED when null or empty and is used verbatim when supplied.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptScheduleFilterInput {
    private List<String> statuses;
    private List<String> supportedPlatforms;
    private List<String> authorIds;
    private String startAtFrom;
    private String startAtTo;
}
