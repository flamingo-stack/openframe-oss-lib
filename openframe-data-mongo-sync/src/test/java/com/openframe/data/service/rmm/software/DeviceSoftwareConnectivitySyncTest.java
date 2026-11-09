package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareConnectivitySyncTest {

    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;

    @InjectMocks private DeviceSoftwareConnectivitySync sync;

    @Test
    @DisplayName("leaving CONNECTED flips the machine's rows in one bulk write and re-projects every title and CVE")
    void disconnect_bulkFlipsAndReprojects() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(true)
                        .vulnerabilities(List.of("CVE-1", "CVE-2")).build(),
                DeviceSoftware.builder().machineId("m1").softwareTitleId(99L).machineConnected(true)
                        .vulnerabilities(List.of("CVE-1")).build()));  // CVE-1 shared across the two titles

        sync.onConnectivityChanged("t1", "m1", false);

        verify(deviceSoftwareRepository).setMachineConnectedByTenantIdAndMachineId("t1", "m1", false);
        verify(projectionTrigger).titlesChanged("t1", Set.of(42L, 99L));
        verify(projectionTrigger).cvesChanged("t1", Set.of("CVE-1", "CVE-2"));  // CVE-1 once across the two titles
    }

    @Test
    @DisplayName("restoring to CONNECTED flips rows back in one bulk write")
    void reconnect_bulkFlipsBack() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(false).build()));

        sync.onConnectivityChanged("t1", "m1", true);

        verify(deviceSoftwareRepository).setMachineConnectedByTenantIdAndMachineId("t1", "m1", true);
        verify(projectionTrigger).titlesChanged("t1", Set.of(42L));
    }

    @Test
    @DisplayName("rows already in the target state are left untouched and nothing is re-projected")
    void noChange_whenAlreadyInSync() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(false).build()));

        sync.onConnectivityChanged("t1", "m1", false);

        verify(deviceSoftwareRepository, never()).setMachineConnectedByTenantIdAndMachineId(any(), any(), anyBoolean());
        verifyNoInteractions(projectionTrigger);
    }

    @Test
    @DisplayName("no software rows: nothing happens")
    void noRows_noop() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of());

        sync.onConnectivityChanged("t1", "m1", true);

        verify(deviceSoftwareRepository, never()).setMachineConnectedByTenantIdAndMachineId(any(), any(), anyBoolean());
        verifyNoInteractions(projectionTrigger);
    }

    @Test
    @DisplayName("a null tenant or machine id touches nothing")
    void nullIds_noop() {
        sync.onConnectivityChanged(null, "m1", true);
        sync.onConnectivityChanged("t1", null, true);

        verifyNoInteractions(deviceSoftwareRepository, projectionTrigger);
    }
}
