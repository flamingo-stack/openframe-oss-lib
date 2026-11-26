package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.DayOfWeek;
import java.util.List;

// The clock of the device, not of the server. toTime earlier than fromTime = the window ends on the next day.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateMaintenanceWindow {

    private List<DayOfWeek> daysOfWeek;
    // HH:mm, 24 hours.
    private String fromTime;
    private String toTime;
}
