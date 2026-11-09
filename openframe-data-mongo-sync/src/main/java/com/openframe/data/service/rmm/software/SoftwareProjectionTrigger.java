package com.openframe.data.service.rmm.software;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.function.IntSupplier;

// The one way into the software read-model projectors: whatever changes device_software reports the titles and CVEs
// it touched here, so how they are re-projected (now right away) is decided in one place.
@Component
public class SoftwareProjectionTrigger {

    static final String TIMER = "openframe.software.projection";
    static final String DEVICES = "openframe.software.projection.devices";

    private static final String TAG_KIND = "kind";
    private static final String KIND_TITLE = "title";
    private static final String KIND_CVE = "cve";
    private static final String TAG_OUTCOME = "outcome";
    private static final String OUTCOME_SUCCESS = "success";
    private static final String OUTCOME_ERROR = "error";

    private final SoftwareProjector softwareProjector;
    private final VulnerabilityProjector vulnerabilityProjector;
    private final MeterRegistry meterRegistry;

    // not every deployable that deletes machines has a meter registry; without one the metrics go nowhere
    public SoftwareProjectionTrigger(SoftwareProjector softwareProjector,
                                     VulnerabilityProjector vulnerabilityProjector,
                                     ObjectProvider<MeterRegistry> meterRegistry) {
        this.softwareProjector = softwareProjector;
        this.vulnerabilityProjector = vulnerabilityProjector;
        this.meterRegistry = meterRegistry.getIfAvailable(() -> Metrics.globalRegistry);
    }

    public void titlesChanged(String tenantId, Collection<Long> softwareTitleIds) {
        if (tenantId == null) {
            return;
        }
        softwareTitleIds.forEach(titleId -> project(KIND_TITLE, () -> softwareProjector.project(tenantId, titleId)));
    }

    public void cvesChanged(String tenantId, Collection<String> cveIds) {
        if (tenantId == null) {
            return;
        }
        cveIds.forEach(cveId -> project(KIND_CVE, () -> vulnerabilityProjector.project(tenantId, cveId)));
    }

    // a projection that throws is timed too, tagged as an error, so slow failing rollups show on the dashboard
    private void project(String kind, IntSupplier projection) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = OUTCOME_ERROR;
        try {
            int devices = projection.getAsInt();
            outcome = OUTCOME_SUCCESS;
            DistributionSummary summary = meterRegistry.summary(DEVICES, TAG_KIND, kind);
            summary.record(devices);
        } finally {
            Timer timer = meterRegistry.timer(TIMER, TAG_KIND, kind, TAG_OUTCOME, outcome);
            sample.stop(timer);
        }
    }
}
