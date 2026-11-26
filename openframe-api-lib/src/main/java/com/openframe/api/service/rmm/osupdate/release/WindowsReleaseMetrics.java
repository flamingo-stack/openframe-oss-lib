package com.openframe.api.service.rmm.osupdate.release;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// Tenant ids are never tags: every tenant's api service is its own scrape target.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.os-versions.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
public class WindowsReleaseMetrics {

    private static final String SOURCE_FAILED_COUNTER = "openframe.rmm.os_update.os_versions.source_failed";
    private static final String TAG_SOURCE = "source";
    private static final String SOURCE_ENDOFLIFE = "endoflife";

    private final MeterRegistry meterRegistry;

    public void recordSourceFailed() {
        meterRegistry.counter(SOURCE_FAILED_COUNTER, TAG_SOURCE, SOURCE_ENDOFLIFE).increment();
    }
}
