package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class OsUpdateRestartDeadlineCalculator {

    // The days run from the later of the two moments: a device that met the update late gets the full time, and so
    // does a device whose ring got the update late.
    public OsUpdateRestartDeadlineDates calculate(OsUpdateRestartDeadline osUpdateRestartDeadline,
                                                  Instant discoveredAt, Instant installFrom) {
        Instant countedFrom = discoveredAt.isAfter(installFrom) ? discoveredAt : installFrom;
        return OsUpdateRestartDeadlineDates.builder()
                .focusAt(countedFrom.plus(osUpdateRestartDeadline.getFocusDays(), ChronoUnit.DAYS))
                .softAt(countedFrom.plus(osUpdateRestartDeadline.getSoftDays(), ChronoUnit.DAYS))
                .hardAt(countedFrom.plus(osUpdateRestartDeadline.getHardDays(), ChronoUnit.DAYS))
                .build();
    }
}
