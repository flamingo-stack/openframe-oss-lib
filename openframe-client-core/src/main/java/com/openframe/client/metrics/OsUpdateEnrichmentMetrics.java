package com.openframe.client.metrics;

import com.openframe.client.service.rmm.osupdate.enrichment.OsUpdateSource;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

// Tenant ids are never tags: every tenant's client service is its own scrape target.
@Component
@RequiredArgsConstructor
public class OsUpdateEnrichmentMetrics {

    private static final String RUN_DURATION_TIMER = "openframe.rmm.os_update.enrichment.duration";
    private static final String ENTRIES_COUNTER = "openframe.rmm.os_update.enrichment.entries";
    private static final String SOURCE_FAILED_COUNTER = "openframe.rmm.os_update.enrichment.source_failed";

    private static final String TAG_PLATFORM = "platform";
    private static final String TAG_RESULT = "result";
    private static final String TAG_SOURCE = "source";

    private static final String RESULT_ENRICHED = "enriched";
    private static final String RESULT_NO_DATA = "no_data";

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

    public void recordSourceFailed(OsUpdateSource osUpdateSource) {
        meterRegistry.counter(SOURCE_FAILED_COUNTER,
                TAG_SOURCE, osUpdateSource.name().toLowerCase(Locale.ROOT)).increment();
    }
}
