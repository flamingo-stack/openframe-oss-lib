package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareBundleOnlineDispatchServiceTest {

    private static final String TENANT = "t1";
    private static final String BUNDLE_ID = "b1";

    @Mock private SoftwareBundleOnlineDispatchRepository dispatchRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private SoftwareBundleRepository bundleRepository;
    @Mock private SoftwareBundleOnlineDispatcher bundleDispatcher;

    private SoftwareBundleOnlineDispatchService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareBundleOnlineDispatchService(dispatchRepository, machineRepository, bundleRepository, bundleDispatcher);
        ReflectionTestUtils.setField(service, "batchSize", 500);
    }

    @Test
    @DisplayName("empty batch: nothing loaded or dispatched")
    void emptyBatch_noop() {
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of());

        service.processDevicesBecameOnline();

        verifyNoInteractions(machineRepository, bundleRepository, bundleDispatcher);
        verify(dispatchRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("fires the online device, marks it DISPATCHED, and leaves the offline device NEW for a later tick")
    void firesOnline_leavesOfflineNew() {
        SoftwareBundleOnlineDispatch online = sentinel("m-online");
        SoftwareBundleOnlineDispatch offline = sentinel("m-offline");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(online, offline));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-online", DeviceStatus.ONLINE), machine("m-offline", DeviceStatus.OFFLINE)));
        SoftwareBundle bundle = SoftwareBundle.builder().id(BUNDLE_ID).tenantId(TENANT).build();
        when(bundleRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(bundle));

        service.processDevicesBecameOnline();

        // Only the online device is dispatched.
        ArgumentCaptor<Machine> fired = ArgumentCaptor.forClass(Machine.class);
        verify(bundleDispatcher).dispatch(eq(bundle), fired.capture());
        assertThat(fired.getValue().getMachineId()).isEqualTo("m-online");

        // Only the online sentinel is persisted, as DISPATCHED; the offline one is untouched (still NEW).
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SoftwareBundleOnlineDispatch>> saved = ArgumentCaptor.forClass(List.class);
        verify(dispatchRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1);
        assertThat(saved.getValue().get(0).getMachineId()).isEqualTo("m-online");
        assertThat(saved.getValue().get(0).getStatus()).isEqualTo(DeviceOnlineDispatchStatus.DISPATCHED);
        assertThat(saved.getValue().get(0).getDispatchedAt()).isNotNull();
        assertThat(offline.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
    }

    private static SoftwareBundleOnlineDispatch sentinel(String machineId) {
        return SoftwareBundleOnlineDispatch.builder()
                .tenantId(TENANT).machineId(machineId).bundleId(BUNDLE_ID)
                .status(DeviceOnlineDispatchStatus.NEW).build();
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        return m;
    }
}
