package com.openframe.data.service.rmm.software;

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

    private void project(String kind, IntSupplier projection) {
        Timer.Sample sample = Timer.start(meterRegistry);
        int devices = projection.getAsInt();
        sample.stop(meterRegistry.timer(TIMER, TAG_KIND, kind));
        meterRegistry.summary(DEVICES, TAG_KIND, kind).record(devices);
    }
}
