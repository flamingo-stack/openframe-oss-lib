package com.openframe.data.service.rmm.software;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareProjectionTriggerTest {

    @Mock private SoftwareProjector softwareProjector;
    @Mock private VulnerabilityProjector vulnerabilityProjector;

    private SimpleMeterRegistry registry;
    private SoftwareProjectionTrigger trigger;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        trigger = new SoftwareProjectionTrigger(softwareProjector, vulnerabilityProjector,
                new StaticListableBeanFactory(Map.of("registry", registry)).getBeanProvider(MeterRegistry.class));
    }

    @Test
    void titlesChanged_projectsEveryTitleAndRecordsTimeAndDevices() {
        when(softwareProjector.project("t1", 42L)).thenReturn(3);
        when(softwareProjector.project("t1", 99L)).thenReturn(5);

        trigger.titlesChanged("t1", List.of(42L, 99L));

        verify(softwareProjector).project("t1", 42L);
        verify(softwareProjector).project("t1", 99L);
        Timer timer = registry.get(SoftwareProjectionTrigger.TIMER).tag("kind", "title").timer();
        assertThat(timer.count()).isEqualTo(2);
        DistributionSummary devices = registry.get(SoftwareProjectionTrigger.DEVICES).tag("kind", "title").summary();
        assertThat(devices.count()).isEqualTo(2);
        assertThat(devices.totalAmount()).isEqualTo(8);
        verifyNoInteractions(vulnerabilityProjector);
    }

    @Test
    void cvesChanged_projectsEveryCveAndRecordsTimeAndDevices() {
        when(vulnerabilityProjector.project("t1", "CVE-1")).thenReturn(4);

        trigger.cvesChanged("t1", List.of("CVE-1"));

        verify(vulnerabilityProjector).project("t1", "CVE-1");
        assertThat(registry.get(SoftwareProjectionTrigger.TIMER).tag("kind", "cve").timer().count()).isEqualTo(1);
        assertThat(registry.get(SoftwareProjectionTrigger.DEVICES).tag("kind", "cve").summary().totalAmount()).isEqualTo(4);
        verifyNoInteractions(softwareProjector);
    }

    @Test
    void failedProjection_isTimedAsErrorAndRecordsNoDevices() {
        IllegalStateException failure = new IllegalStateException("mongo down");
        when(softwareProjector.project("t1", 42L)).thenThrow(failure);

        assertThatThrownBy(() -> trigger.titlesChanged("t1", List.of(42L))).isSameAs(failure);

        Timer failed = registry.get(SoftwareProjectionTrigger.TIMER)
                .tags("kind", "title", "outcome", "error").timer();
        assertThat(failed.count()).isEqualTo(1);
        assertThat(registry.find(SoftwareProjectionTrigger.TIMER).tag("outcome", "success").timer()).isNull();
        assertThat(registry.find(SoftwareProjectionTrigger.DEVICES).summary()).isNull();
    }

    @Test
    void successfulProjection_isTimedAsSuccess() {
        when(vulnerabilityProjector.project("t1", "CVE-1")).thenReturn(1);

        trigger.cvesChanged("t1", List.of("CVE-1"));

        assertThat(registry.get(SoftwareProjectionTrigger.TIMER)
                .tags("kind", "cve", "outcome", "success").timer().count()).isEqualTo(1);
    }

    @Test
    void nullTenant_isNoOp() {
        trigger.titlesChanged(null, List.of(42L));
        trigger.cvesChanged(null, List.of("CVE-1"));

        verifyNoInteractions(softwareProjector, vulnerabilityProjector);
        assertThat(registry.getMeters()).isEmpty();
    }

    @Test
    void noMeterRegistry_stillProjects() {
        SoftwareProjectionTrigger withoutRegistry = new SoftwareProjectionTrigger(softwareProjector, vulnerabilityProjector,
                new StaticListableBeanFactory().getBeanProvider(MeterRegistry.class));

        withoutRegistry.titlesChanged("t1", List.of(42L));

        verify(softwareProjector).project("t1", 42L);
    }
}
