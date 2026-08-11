package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.rmm.OsType;
import lombok.Data;

import java.util.List;

@Data
public class ScheduleDeviceCriteriaInput {

    private List<String> organizationIds;

    private List<DeviceType> deviceTypes;

    private List<OsType> osTypes;
}
