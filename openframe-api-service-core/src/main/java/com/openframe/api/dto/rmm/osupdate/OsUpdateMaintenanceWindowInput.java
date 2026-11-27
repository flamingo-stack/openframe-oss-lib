package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateMaintenanceWindowInput {

    private OsUpdateDeviceClass deviceClass;
    private List<DayOfWeek> daysOfWeek;
    private String fromTime;
    private String toTime;
}
