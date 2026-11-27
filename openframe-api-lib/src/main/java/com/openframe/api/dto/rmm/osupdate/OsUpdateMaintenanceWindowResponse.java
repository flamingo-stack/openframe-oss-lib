package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import lombok.Builder;
import lombok.Data;

import java.time.DayOfWeek;
import java.util.List;

@Data
@Builder
public class OsUpdateMaintenanceWindowResponse {

    private OsUpdateDeviceClass deviceClass;
    private List<DayOfWeek> daysOfWeek;
    private String fromTime;
    private String toTime;
}
