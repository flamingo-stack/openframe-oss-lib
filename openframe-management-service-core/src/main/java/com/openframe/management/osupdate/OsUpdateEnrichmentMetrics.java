package com.openframe.management.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

// Tenant ids are never tags: every tenant's management service is its own scrape target.
@Component
@RequiredArgsConstructor
public class OsUpdateEnrichmentMetrics {

    private static final String RUN_DURATION_TIMER = "openframe.rmm.os_update.enrichment.duration";
    private static final String ENTRIES_COUNTER = "openframe.rmm.os_update.enrichment.entries";
    private static final String SOURCE_FETCH_COUNTER = "openframe.rmm.os_update.enrichment.source_fetch";
    private static final String ERRORS_COUNTER = "openframe.rmm.os_update.enrichment.errors";

    private static final String TAG_PLATFORM = "platform";
    private static final String TAG_RESULT = "result";
    private static final String TAG_SOURCE = "source";
    private static final String TAG_STAGE = "stage";

    private static final String RESULT_ENRICHED = "enriched";
    private static final String RESULT_NO_DATA = "no_data";
    private static final String RESULT_SUCCESS = "success";
    private static final String RESULT_FAILURE = "failure";

    private static final String STAGE_ENRICHER = "enricher";
    private static final String STAGE_BATCH = "batch";
    private static final String STAGE_RUN = "run";

    private final MeterRegistry meterRegistry;

    public Timer.Sample startRun() {
        return Timer.start(meterRegistry);
    }

    public void recordRun(Timer.Sample runStarted) {
        runStarted.stop(meterRegistry.timer(RUN_DURATION_TIMER));
    }

    public void recordEnriched(OsPlatform platform) {
        meterRegistry.counter(ENTRIES_COUNTER, TAG_PLATFORM, platform.name(), TAG_RESULT, RESULT_ENRICHED).increment();
    }

    // Checked, but no source has data on the update: a preview, a driver, or a platform without an enricher.
    public void recordNoData(OsPlatform platform) {
        meterRegistry.counter(ENTRIES_COUNTER, TAG_PLATFORM, platform.name(), TAG_RESULT, RESULT_NO_DATA).increment();
    }

    public void recordSourceFetched(OsUpdateSource osUpdateSource) {
        recordSourceFetch(osUpdateSource, RESULT_SUCCESS);
    }

    public void recordSourceFailed(OsUpdateSource osUpdateSource) {
        recordSourceFetch(osUpdateSource, RESULT_FAILURE);
    }

    public void recordEnricherFailed() {
        recordError(STAGE_ENRICHER);
    }

    public void recordBatchFailed() {
        recordError(STAGE_BATCH);
    }

    public void recordRunFailed() {
        recordError(STAGE_RUN);
    }

    private void recordSourceFetch(OsUpdateSource osUpdateSource, String result) {
        String sourceTag = osUpdateSource.name().toLowerCase(Locale.ROOT);
        meterRegistry.counter(SOURCE_FETCH_COUNTER, TAG_SOURCE, sourceTag, TAG_RESULT, result).increment();
    }

    private void recordError(String stage) {
        meterRegistry.counter(ERRORS_COUNTER, TAG_STAGE, stage).increment();
    }
}
