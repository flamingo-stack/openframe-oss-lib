package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.CascadeSyncType;
import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import com.openframe.data.document.rmm.software.SoftwareCascadeSync;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOsVulnerabilityRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareCveRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareCascadeSyncRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareCascadeSyncServiceTest {

    @Mock private SoftwareCascadeSyncRepository cascadeRepository;
    @Mock private DeviceCveWriter deviceCveWriter;
    @Mock private DeviceCveRepository deviceCveRepository;
    @Mock private FleetSoftwareRepository fleetSoftwareRepository;
    @Mock private FleetSoftwareCveRepository fleetSoftwareCveRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private FleetOsVulnerabilityRepository fleetOsVulnerabilityRepository;
    @Mock private DeviceOperatingSystemRepository deviceOperatingSystemRepository;
    @Mock private TenantSoftwareCveAggregator tenantSoftwareCveAggregator;

    @InjectMocks private SoftwareCascadeSyncService service;

    private void withBatchSize(int size) {
        ReflectionTestUtils.setField(service, "batchSize", size);
    }

    @Test
    void enqueueSoftwareCve_savesNewRowWithDeterministicId() {
        service.enqueueSoftwareCve(200L);

        ArgumentCaptor<SoftwareCascadeSync> captor = ArgumentCaptor.forClass(SoftwareCascadeSync.class);
        verify(cascadeRepository).save(captor.capture());
        SoftwareCascadeSync row = captor.getValue();
        assertThat(row.getId()).isEqualTo("SOFTWARE_CVE:200");   // deterministic → dedups repeated events
        assertThat(row.getType()).isEqualTo(CascadeSyncType.SOFTWARE_CVE);
        assertThat(row.getSoftwareId()).isEqualTo(200L);
        assertThat(row.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        assertThat(row.getCreatedAt()).isNotNull();
    }

    @Test
    void enqueue_nullKey_doesNothing() {
        service.enqueueOsVuln(null);
        verifyNoInteractions(cascadeRepository);
    }

    @Test
    void processBatch_empty_isNoOp() {
        withBatchSize(500);
        when(cascadeRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of());

        service.processBatch();

        verify(cascadeRepository, never()).saveAll(any());
        verifyNoInteractions(deviceCveWriter, tenantSoftwareCveAggregator);
    }

    @Test
    void processBatch_softwareCve_resyncsDevicesDropsStaleCveAndMarksProcessed() {
        withBatchSize(500);
        SoftwareCascadeSync item = SoftwareCascadeSync.builder()
                .id("SOFTWARE_CVE:200").type(CascadeSyncType.SOFTWARE_CVE).softwareId(200L)
                .status(DeviceOnlineDispatchStatus.NEW).build();
        when(cascadeRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(item));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).version("1.0").build()));
        when(fleetSoftwareCveRepository.findBySoftwareId(200L)).thenReturn(List.of(
                FleetSoftwareCve.builder().cve("CVE-1").build(),
                FleetSoftwareCve.builder().cve("CVE-2").build()));
        when(deviceSoftwareRepository.findBySoftwareId(200L)).thenReturn(List.of(
                DeviceSoftware.builder().tenantId("t1").machineId("m1").hostId(100L).softwareTitleId(42L).version("1.0").build()));
        DeviceCve stale = DeviceCve.builder().cveId("CVE-OLD").softwareId(200L).build();
        when(deviceCveRepository.findByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L)).thenReturn(List.of(stale));

        service.processBatch();

        verify(deviceCveWriter, times(2)).upsert(any(), any(), any(), any(), any(), any(), any(), any());
        verify(deviceCveRepository).delete(stale);   // CVE-OLD no longer in catalog
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);

        ArgumentCaptor<List<SoftwareCascadeSync>> saved = ArgumentCaptor.forClass(List.class);
        verify(cascadeRepository).saveAll(saved.capture());
        assertThat(saved.getValue().get(0).getStatus()).isEqualTo(DeviceOnlineDispatchStatus.PROCESSED);
        assertThat(saved.getValue().get(0).getProcessedAt()).isNotNull();
    }

    @Test
    void processBatch_itemFails_leavesItNewForRetry() {
        withBatchSize(500);
        SoftwareCascadeSync item = SoftwareCascadeSync.builder()
                .id("SOFTWARE_CVE:200").type(CascadeSyncType.SOFTWARE_CVE).softwareId(200L)
                .status(DeviceOnlineDispatchStatus.NEW).build();
        when(cascadeRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(item));
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenThrow(new RuntimeException("mongo down"));

        service.processBatch();

        // failed item is not saved as PROCESSED → stays NEW for the next sweep
        verify(cascadeRepository, never()).saveAll(any());
    }
}
