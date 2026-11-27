package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Days a restart may wait: until focusDays the dialog stays silent while the user is busy, from softDays it can no
// longer be deferred, at hardDays the device restarts on its own.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateRestartDeadline {

    private Integer focusDays;

    private Integer softDays;

    private Integer hardDays;
}
