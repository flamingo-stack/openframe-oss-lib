package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateRestartDeadlineCalculatorTest {

    private final OsUpdateRestartDeadlineCalculator osUpdateRestartDeadlineCalculator =
            new OsUpdateRestartDeadlineCalculator();
    private final OsUpdateRestartDeadline osUpdateRestartDeadline = OsUpdateRestartDeadline.builder()
            .focusDays(1).softDays(5).hardDays(7).build();

    @Test
    void calculate_deviceMetTheUpdateBeforeItsRingGotIt_daysRunFromInstallFrom() {
        // execution
        OsUpdateRestartDeadlineDates dates = osUpdateRestartDeadlineCalculator.calculate(osUpdateRestartDeadline,
                Instant.parse("2026-10-13T20:00:00Z"), Instant.parse("2026-10-17T17:00:00Z"));

        // verifications
        assertThat(dates.getFocusAt()).isEqualTo(Instant.parse("2026-10-18T17:00:00Z"));
        assertThat(dates.getSoftAt()).isEqualTo(Instant.parse("2026-10-22T17:00:00Z"));
        assertThat(dates.getHardAt()).isEqualTo(Instant.parse("2026-10-24T17:00:00Z"));
    }

    @Test
    void calculate_deviceMetTheUpdateAfterItsRingGotIt_daysRunFromTheDiscovery() {
        // execution
        OsUpdateRestartDeadlineDates dates = osUpdateRestartDeadlineCalculator.calculate(osUpdateRestartDeadline,
                Instant.parse("2026-11-05T08:00:00Z"), Instant.parse("2026-10-17T17:00:00Z"));

        // verifications
        assertThat(dates.getFocusAt()).isEqualTo(Instant.parse("2026-11-06T08:00:00Z"));
        assertThat(dates.getSoftAt()).isEqualTo(Instant.parse("2026-11-10T08:00:00Z"));
        assertThat(dates.getHardAt()).isEqualTo(Instant.parse("2026-11-12T08:00:00Z"));
    }
}
