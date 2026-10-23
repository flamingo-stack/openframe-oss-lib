package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * The stored "Select Devices by Criteria" rule of a CRITERIA schedule: each list is a whitelist,
 * empty or null meaning no constraint on that dimension. Null on SPECIFIC schedules.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleDeviceCriteria {
    private List<String> organizationIds;
    private List<String> deviceTypes;
    private List<String> osTypes;
}
