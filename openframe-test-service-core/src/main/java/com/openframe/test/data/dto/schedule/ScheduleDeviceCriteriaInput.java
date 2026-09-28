package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Input for {@code setScheduleDeviceCriteria}: mirrors the customer / device-type / OS filters of
 * the picker. Omitted lists mean no constraint; {@code osTypes} is intersected with the schedule's
 * {@code supportedPlatforms}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScheduleDeviceCriteriaInput {
    private List<String> organizationIds;
    private List<String> deviceTypes;
    private List<String> osTypes;
}
