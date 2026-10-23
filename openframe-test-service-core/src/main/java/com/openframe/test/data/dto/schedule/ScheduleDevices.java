package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The device-targeting view of one schedule as returned by {@code ScriptScheduleQueries.GET_SCHEDULE_DEVICES}:
 * the DEVICES count, the selection mode and rule, and the two pickers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleDevices {
    private String id;
    private Integer deviceCount;
    private String selectionMode;
    private ScheduleDeviceCriteria deviceCriteria;
    private ScheduleDeviceConnection assignedDevices;
    private ScheduleDeviceConnection availableDevices;
}
