package com.openframe.client.metrics;

import com.openframe.client.service.rmm.osupdate.DeviceOsReport;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportOutcome;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class DeviceOsReportMetricsTest {

    private static final String REPORT_DURATION_TIMER = "openframe.rmm.os_update.report.duration";
    private static final String REPORT_FAILED_COUNTER = "openframe.rmm.os_update.report.failed";
    private static final String REPORT_LAG_TIMER = "openframe.rmm.os_update.report.lag";
    private static final String REPORT_PAYLOAD_SUMMARY = "openframe.rmm.os_update.report.payload";
    private static final String REPORT_INTERVAL_TIMER = "openframe.rmm.os_update.report.interval";
    private static final String REPORT_UNKNOWN_VALUE_COUNTER = "openframe.rmm.os_update.report.unknown_value";
    private static final String REPORT_PENDING_UPDATES_SUMMARY = "openframe.rmm.os_update.report.pending_updates";
    private static final String REPORT_HISTORY_ENTRIES_SUMMARY = "openframe.rmm.os_update.report.history_entries";
    private static final String DEVICE_FIRST_REPORT_COUNTER = "openframe.rmm.os_update.device.first_report";
    private static final String CATALOGUE_SAVED_COUNTER = "openframe.rmm.os_update.catalogue.saved";
    private static final String PENDING_UPDATES_WRITTEN_COUNTER = "openframe.rmm.os_update.pending_updates.written";
    private static final String HISTORY_SAVED_COUNTER = "openframe.rmm.os_update.history.saved";
    private static final String HISTORY_OUTSIDE_RETENTION_COUNTER = "openframe.rmm.os_update.history.outside_retention";
    private static final String HISTORY_LOG_PUBLISHED_COUNTER = "openframe.rmm.os_update.history.log_published";

    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final DeviceOsReportMetrics metrics = new DeviceOsReportMetrics(registry);

    @Test
    void recordReceived_report_payloadSizeSummarisedInBytes() {
        // setup
        Instant storedInStreamAt = Instant.now();

        // execution
        metrics.recordReceived(2048, storedInStreamAt);

        // verifications
        DistributionSummary payload = registry.get(REPORT_PAYLOAD_SUMMARY).summary();
        assertThat(payload.getId().getBaseUnit()).isEqualTo("bytes");
        assertThat(payload)
                .extracting(DistributionSummary::count, DistributionSummary::totalAmount)
                .containsExactly(1L, 2048.0);
    }

    @Test
    void recordReceived_reportThatWaitedInTheStream_lagIsTheTimeSinceItWasStoredThere() {
        // setup
        Instant storedInStreamAt = Instant.now().minus(Duration.ofMinutes(5));

        // execution
        metrics.recordReceived(2048, storedInStreamAt);

        // verifications
        Timer lag = registry.get(REPORT_LAG_TIMER).timer();
        assertThat(lag.count()).isEqualTo(1L);
        assertThat(lag.totalTime(TimeUnit.SECONDS)).isBetween(300.0, 360.0);
    }

    @ParameterizedTest
    @CsvSource({
            "APPLIED, applied",
            "IGNORED_OLDER, ignored_older",
            "UNKNOWN_MACHINE, unknown_machine",
            "FROZEN_MACHINE, frozen_machine",
            "MALFORMED, malformed",
            "FAILED, failed"
    })
    void recordHandled_outcome_durationTimedUnderTheLowerCaseOutcome(DeviceOsReportOutcome outcome, String tag) {
        // setup
        Timer.Sample reportStarted = metrics.startReport();

        // execution
        metrics.recordHandled(reportStarted, outcome);

        // verifications
        assertThat(registry.get(REPORT_DURATION_TIMER).tags("outcome", tag).timer().count()).isEqualTo(1L);
        assertThat(registry.get(REPORT_DURATION_TIMER).timers()).hasSize(1);
    }

    @Test
    void recordFailed_failures_countedPerExceptionClass() {
        // setup
        DataAccessResourceFailureException mongoDown = new DataAccessResourceFailureException("mongo is down");
        IllegalStateException notSaved = new IllegalStateException("state not saved");

        // execution
        metrics.recordFailed(mongoDown);
        metrics.recordFailed(mongoDown);
        metrics.recordFailed(notSaved);

        // verifications
        assertThat(registry.get(REPORT_FAILED_COUNTER)
                .tags("exception", "DataAccessResourceFailureException").counter().count()).isEqualTo(2.0);
        assertThat(registry.get(REPORT_FAILED_COUNTER)
                .tags("exception", "IllegalStateException").counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordApplied_report_pendingUpdatesAndHistoryEntriesSummarisedByPlatformAndConfidence() {
        // setup
        DeviceOsReport deviceOsReport = report(OsPlatform.WINDOWS, OsUpdateListConfidence.CONFIRMED);

        // execution
        metrics.recordApplied(deviceOsReport);

        // verifications
        DistributionSummary pendingUpdates = registry.get(REPORT_PENDING_UPDATES_SUMMARY)
                .tags("platform", "WINDOWS", "confidence", "CONFIRMED").summary();
        DistributionSummary historyEntries = registry.get(REPORT_HISTORY_ENTRIES_SUMMARY)
                .tags("platform", "WINDOWS").summary();
        assertThat(List.of(pendingUpdates, historyEntries))
                .extracting(DistributionSummary::count, DistributionSummary::totalAmount)
                .containsExactly(tuple(1L, 2.0), tuple(1L, 3.0));
    }

    @Test
    void recordApplied_reportWithoutAConfidence_confidenceTaggedNone() {
        // setup
        DeviceOsReport deviceOsReport = report(OsPlatform.MACOS, null);

        // execution
        metrics.recordApplied(deviceOsReport);

        // verifications
        assertThat(registry.get(REPORT_PENDING_UPDATES_SUMMARY)
                .tags("platform", "MACOS", "confidence", "NONE").summary().count()).isEqualTo(1L);
    }

    @Test
    void recordFirstReport_platform_countedUnderThePlatform() {
        // setup

        // execution
        metrics.recordFirstReport(OsPlatform.MACOS);

        // verifications
        assertThat(registry.get(DEVICE_FIRST_REPORT_COUNTER).tags("platform", "MACOS").counter().count())
                .isEqualTo(1.0);
    }

    @Test
    void recordReportInterval_twoReportsSixHoursApart_timerRecordsTheirDifference() {
        // setup
        Instant previousReceivedAt = RECEIVED_AT.minus(Duration.ofHours(6));

        // execution
        metrics.recordReportInterval(OsPlatform.WINDOWS, previousReceivedAt, RECEIVED_AT);

        // verifications
        Timer interval = registry.get(REPORT_INTERVAL_TIMER).tags("platform", "WINDOWS").timer();
        assertThat(interval.count()).isEqualTo(1L);
        assertThat(interval.totalTime(TimeUnit.SECONDS)).isEqualTo(21600.0);
    }

    @Test
    void recordUnknownValue_enumType_countedUnderTheSimpleNameOfTheType() {
        // setup

        // execution
        metrics.recordUnknownValue(OsUpdateSeverity.class);

        // verifications
        assertThat(registry.get(REPORT_UNKNOWN_VALUE_COUNTER).tags("field", "OsUpdateSeverity").counter().count())
                .isEqualTo(1.0);
    }

    @Test
    void recordOsUpdateSaved_platform_countedUnderThePlatform() {
        // setup

        // execution
        metrics.recordOsUpdateSaved(OsPlatform.WINDOWS);

        // verifications
        assertThat(registry.get(CATALOGUE_SAVED_COUNTER).tags("platform", "WINDOWS").counter().count())
                .isEqualTo(1.0);
    }

    @Test
    void recordPendingUpdatesWritten_counts_eachAddedToTheCounterOfItsChange() {
        // setup

        // execution
        metrics.recordPendingUpdatesWritten(3, 2, 1);

        // verifications
        assertThat(registry.get(PENDING_UPDATES_WRITTEN_COUNTER).tags("change", "added").counter().count())
                .isEqualTo(3.0);
        assertThat(registry.get(PENDING_UPDATES_WRITTEN_COUNTER).tags("change", "changed").counter().count())
                .isEqualTo(2.0);
        assertThat(registry.get(PENDING_UPDATES_WRITTEN_COUNTER).tags("change", "removed").counter().count())
                .isEqualTo(1.0);
    }

    @Test
    void recordHistoryOutsideRetention_count_addedToTheCounter() {
        // setup

        // execution
        metrics.recordHistoryOutsideRetention(4);

        // verifications
        assertThat(registry.get(HISTORY_OUTSIDE_RETENTION_COUNTER).counter().count()).isEqualTo(4.0);
    }

    @Test
    void recordHistorySaved_entries_countedPerOperationAndResult() {
        // setup
        List<DeviceOsUpdateHistoryEntry> savedHistoryEntries = List.of(
                historyEntry(OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                historyEntry(OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.FAILED));

        // execution
        metrics.recordHistorySaved(savedHistoryEntries);

        // verifications
        assertThat(registry.get(HISTORY_SAVED_COUNTER)
                .tags("operation", "INSTALL", "result", "SUCCEEDED").counter().count()).isEqualTo(2.0);
        assertThat(registry.get(HISTORY_SAVED_COUNTER)
                .tags("operation", "UNINSTALL", "result", "FAILED").counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordHistorySaved_entryWithoutOperationAndResult_bothTaggedNone() {
        // setup
        List<DeviceOsUpdateHistoryEntry> savedHistoryEntries = List.of(historyEntry(null, null));

        // execution
        metrics.recordHistorySaved(savedHistoryEntries);

        // verifications
        assertThat(registry.get(HISTORY_SAVED_COUNTER)
                .tags("operation", "NONE", "result", "NONE").counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordHistoryLogPublished_calledTwice_counterAccumulates() {
        // setup

        // execution
        metrics.recordHistoryLogPublished();
        metrics.recordHistoryLogPublished();

        // verifications
        assertThat(registry.get(HISTORY_LOG_PUBLISHED_COUNTER).counter().count()).isEqualTo(2.0);
    }

    private static DeviceOsReport report(OsPlatform platform, OsUpdateListConfidence confidence) {
        DeviceOsState deviceOsState = DeviceOsState.builder()
                .platform(platform)
                .pendingUpdatesConfidence(confidence)
                .build();
        return DeviceOsReport.builder()
                .deviceOsState(deviceOsState)
                .pendingUpdates(List.of(
                        DeviceOsPendingUpdate.builder().identifier("kb-1").build(),
                        DeviceOsPendingUpdate.builder().identifier("kb-2").build()))
                .historyEntries(List.of(
                        historyEntry(OsUpdateOperation.INSTALL, OsUpdateInstallResult.SUCCEEDED),
                        historyEntry(OsUpdateOperation.INSTALL, OsUpdateInstallResult.FAILED),
                        historyEntry(OsUpdateOperation.UNINSTALL, OsUpdateInstallResult.SUCCEEDED)))
                .build();
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(OsUpdateOperation operation, OsUpdateInstallResult result) {
        return DeviceOsUpdateHistoryEntry.builder()
                .operation(operation)
                .result(result)
                .build();
    }
}
