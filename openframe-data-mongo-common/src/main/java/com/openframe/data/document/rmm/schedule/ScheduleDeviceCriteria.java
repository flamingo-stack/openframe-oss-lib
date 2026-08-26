package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.rmm.script.OsType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleDeviceCriteria {

    private List<String> organizationIds;

    private List<DeviceType> deviceTypes;

    private List<OsType> osTypes;
}
