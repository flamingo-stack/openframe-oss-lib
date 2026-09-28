package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class PackageCatalogSyncMetrics {

    private static final String SYNC_COUNTER = "openframe.package_catalog.sync";
    private static final String TAG_MANAGER = "manager";
    private static final String TAG_RESULT = "result";
    private static final String RESULT_SUCCESS = "success";
    private static final String RESULT_FAILURE = "failure";

    private final MeterRegistry meterRegistry;

    public PackageCatalogSyncMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void recordSuccess(PackageManagerType manager) {
        record(manager, RESULT_SUCCESS);
    }

    public void recordFailure(PackageManagerType manager) {
        record(manager, RESULT_FAILURE);
    }

    private void record(PackageManagerType manager, String result) {
        String managerTag = manager.name();
        meterRegistry.counter(SYNC_COUNTER, TAG_MANAGER, managerTag, TAG_RESULT, result).increment();
    }
}
