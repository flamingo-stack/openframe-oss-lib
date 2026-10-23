package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PackageCatalogSyncMetricsTest {

    private static final String SYNC_COUNTER = "openframe.package_catalog.sync";

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final PackageCatalogSyncMetrics metrics = new PackageCatalogSyncMetrics(registry);

    @Test
    void recordSuccess_brew_incrementsSuccessSeriesForBrew() {
        // execution
        metrics.recordSuccess(PackageManagerType.BREW);
        metrics.recordSuccess(PackageManagerType.BREW);

        // verifications
        assertThat(registry.get(SYNC_COUNTER).tags("manager", "BREW", "result", "success").counter().count()).isEqualTo(2.0);
    }

    @Test
    void recordFailure_winget_incrementsFailureSeriesForWinget() {
        // execution
        metrics.recordFailure(PackageManagerType.WINGET);

        // verifications
        assertThat(registry.get(SYNC_COUNTER).tags("manager", "WINGET", "result", "failure").counter().count()).isEqualTo(1.0);
    }

    @Test
    void recordSuccessAndFailure_sameManager_separateSeries() {
        // execution
        metrics.recordSuccess(PackageManagerType.BREW);
        metrics.recordFailure(PackageManagerType.BREW);

        // verifications
        assertThat(registry.get(SYNC_COUNTER).tags("manager", "BREW", "result", "success").counter().count()).isEqualTo(1.0);
        assertThat(registry.get(SYNC_COUNTER).tags("manager", "BREW", "result", "failure").counter().count()).isEqualTo(1.0);
    }
}
