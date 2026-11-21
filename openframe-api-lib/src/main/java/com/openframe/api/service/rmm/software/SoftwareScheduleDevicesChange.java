package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareScheduleResponse;
import com.openframe.api.service.rmm.schedule.ScheduleDeviceChange;

public record SoftwareScheduleDevicesChange(SoftwareScheduleResponse schedule, ScheduleDeviceChange devices) {
}
