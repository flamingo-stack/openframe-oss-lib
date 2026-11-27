package com.openframe.client.metrics;

import com.openframe.client.service.rmm.osupdate.DeviceOsReport;
import com.openframe.client.service.rmm.osupdate.DeviceOsReportOutcome;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

// Tenant and machine ids are never tags: every tenant's client service is its own scrape target.
@Component
@RequiredArgsConstructor
public class DeviceOsReportMetrics {

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
    private static final String CATALOGUE_RECLASSIFIED_COUNTER = "openframe.rmm.os_update.catalogue.reclassified";
    private static final String PENDING_UPDATES_WRITTEN_COUNTER = "openframe.rmm.os_update.pending_updates.written";
    private static final String HISTORY_SAVED_COUNTER = "openframe.rmm.os_update.history.saved";
    private static final String HISTORY_OUTSIDE_RETENTION_COUNTER = "openframe.rmm.os_update.history.outside_retention";
    private static final String HISTORY_LOG_PUBLISHED_COUNTER = "openframe.rmm.os_update.history.log_published";

    private static final String TAG_OUTCOME = "outcome";
    private static final String TAG_EXCEPTION = "exception";
    private static final String TAG_PLATFORM = "platform";
    private static final String TAG_FIELD = "field";
    private static final String TAG_CONFIDENCE = "confidence";
    private static final String TAG_CHANGE = "change";
    private static final String TAG_OPERATION = "operation";
    private static final String TAG_RESULT = "result";

    private static final String CHANGE_ADDED = "added";
    private static final String CHANGE_CHANGED = "changed";
    private static final String CHANGE_REMOVED = "removed";
    private static final String NONE = "NONE";
    private static final String BYTES = "bytes";

    private static final Duration[] REPORT_INTERVAL_BUCKETS = {
            Duration.ofSeconds(10), Duration.ofMinutes(1), Duration.ofMinutes(10),
            Duration.ofHours(1), Duration.ofHours(6), Duration.ofHours(24)};

    private final MeterRegistry meterRegistry;

    // Lag = how long the report waited in the stream. The stream drops a report after an hour.
    public void recordReceived(int payloadBytes, Instant storedInStreamAt) {
        DistributionSummary.builder(REPORT_PAYLOAD_SUMMARY)
                .baseUnit(BYTES)
                .register(meterRegistry)
                .record(payloadBytes);
        meterRegistry.timer(REPORT_LAG_TIMER).record(Duration.between(storedInStreamAt, Instant.now()));
    }

    public Timer.Sample startReport() {
        return Timer.start(meterRegistry);
    }

    public void recordHandled(Timer.Sample reportStarted, DeviceOsReportOutcome deviceOsReportOutcome) {
        String outcome = deviceOsReportOutcome.name().toLowerCase(Locale.ROOT);
        reportStarted.stop(meterRegistry.timer(REPORT_DURATION_TIMER, TAG_OUTCOME, outcome));
    }

    // One per delivery attempt: a report that keeps failing is counted on every redelivery.
    public void recordFailed(Exception failure) {
        meterRegistry.counter(REPORT_FAILED_COUNTER, TAG_EXCEPTION, failure.getClass().getSimpleName()).increment();
    }

    public void recordApplied(DeviceOsReport deviceOsReport) {
        DeviceOsState deviceOsState = deviceOsReport.getDeviceOsState();
        String platform = deviceOsState.getPlatform().name();
        String confidence = nameOrNone(deviceOsState.getPendingUpdatesConfidence());
        meterRegistry.summary(REPORT_PENDING_UPDATES_SUMMARY, TAG_PLATFORM, platform, TAG_CONFIDENCE, confidence)
                .record(deviceOsReport.getPendingUpdates().size());
        meterRegistry.summary(REPORT_HISTORY_ENTRIES_SUMMARY, TAG_PLATFORM, platform)
                .record(deviceOsReport.getHistoryEntries().size());
    }

    public void recordFirstReport(OsPlatform platform) {
        meterRegistry.counter(DEVICE_FIRST_REPORT_COUNTER, TAG_PLATFORM, platform.name()).increment();
    }

    // The time between two reports of one device.
    public void recordReportInterval(OsPlatform platform, Instant previousReceivedAt, Instant receivedAt) {
        Timer.builder(REPORT_INTERVAL_TIMER)
                .tags(TAG_PLATFORM, platform.name())
                .serviceLevelObjectives(REPORT_INTERVAL_BUCKETS)
                .register(meterRegistry)
                .record(Duration.between(previousReceivedAt, receivedAt));
    }

    // The field is the enum type, never the value the agent sent.
    public void recordUnknownValue(Class<? extends Enum<?>> enumType) {
        meterRegistry.counter(REPORT_UNKNOWN_VALUE_COUNTER, TAG_FIELD, enumType.getSimpleName()).increment();
    }

    public void recordOsUpdateSaved(OsPlatform platform) {
        meterRegistry.counter(CATALOGUE_SAVED_COUNTER, TAG_PLATFORM, platform.name()).increment();
    }

    public void recordOsUpdateReclassified(OsPlatform platform) {
        meterRegistry.counter(CATALOGUE_RECLASSIFIED_COUNTER, TAG_PLATFORM, platform.name()).increment();
    }

    public void recordPendingUpdatesWritten(long added, long changed, long removed) {
        meterRegistry.counter(PENDING_UPDATES_WRITTEN_COUNTER, TAG_CHANGE, CHANGE_ADDED).increment(added);
        meterRegistry.counter(PENDING_UPDATES_WRITTEN_COUNTER, TAG_CHANGE, CHANGE_CHANGED).increment(changed);
        meterRegistry.counter(PENDING_UPDATES_WRITTEN_COUNTER, TAG_CHANGE, CHANGE_REMOVED).increment(removed);
    }

    public void recordHistoryOutsideRetention(long count) {
        meterRegistry.counter(HISTORY_OUTSIDE_RETENTION_COUNTER).increment(count);
    }

    public void recordHistorySaved(List<DeviceOsUpdateHistoryEntry> savedHistoryEntries) {
        savedHistoryEntries.forEach(savedHistoryEntry -> meterRegistry.counter(HISTORY_SAVED_COUNTER,
                TAG_OPERATION, nameOrNone(savedHistoryEntry.getOperation()),
                TAG_RESULT, nameOrNone(savedHistoryEntry.getResult())).increment());
    }

    public void recordHistoryLogPublished() {
        meterRegistry.counter(HISTORY_LOG_PUBLISHED_COUNTER).increment();
    }

    private static String nameOrNone(Enum<?> value) {
        return value != null ? value.name() : NONE;
    }
}
