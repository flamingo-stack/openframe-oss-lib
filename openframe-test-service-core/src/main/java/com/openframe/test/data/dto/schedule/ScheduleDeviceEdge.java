package com.openframe.test.data.dto.schedule;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.device.Machine;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One edge of a schedule's device pickers. {@code assigned} is only present on
 * {@code availableDevices} edges (AvailableDeviceEdge in the schema) and is null on
 * {@code assignedDevices} edges (a plain DeviceEdge).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScheduleDeviceEdge {
    private Machine node;
    private String cursor;
    private Boolean assigned;
}
