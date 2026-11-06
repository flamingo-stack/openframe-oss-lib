package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareConnectivitySyncTest {

    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjector softwareProjector;
    @Mock private VulnerabilityProjector vulnerabilityProjector;

    @InjectMocks private DeviceSoftwareConnectivitySync sync;

    @Test
    @DisplayName("leaving CONNECTED flips the machine's rows to disconnected and re-projects every title and CVE")
    void disconnect_flipsRowsAndReprojects() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(true)
                        .vulnerabilities(List.of("CVE-1", "CVE-2")).build(),
                DeviceSoftware.builder().machineId("m1").softwareTitleId(99L).machineConnected(true)
                        .vulnerabilities(List.of("CVE-1")).build()));  // CVE-1 shared across the two titles

        sync.onConnectivityChanged("t1", "m1", false);

        ArgumentCaptor<DeviceSoftware> saved = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).noneMatch(DeviceSoftware::isMachineConnected);

        verify(softwareProjector).project("t1", 42L);
        verify(softwareProjector).project("t1", 99L);
        verify(vulnerabilityProjector).project("t1", "CVE-1");  // once, de-duplicated across the two titles
        verify(vulnerabilityProjector).project("t1", "CVE-2");
    }

    @Test
    @DisplayName("restoring to CONNECTED flips rows back to connected")
    void reconnect_flipsRowsBack() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(false).build()));

        sync.onConnectivityChanged("t1", "m1", true);

        ArgumentCaptor<DeviceSoftware> saved = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(saved.capture());
        assertThat(saved.getValue().isMachineConnected()).isTrue();
        verify(softwareProjector).project("t1", 42L);
    }

    @Test
    @DisplayName("rows already in the target state are left untouched and nothing is re-projected")
    void noChange_whenAlreadyInSync() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m1").softwareTitleId(42L).machineConnected(false).build()));

        sync.onConnectivityChanged("t1", "m1", false);

        verify(deviceSoftwareRepository, never()).save(any());
        verifyNoInteractions(softwareProjector, vulnerabilityProjector);
    }

    @Test
    @DisplayName("no software rows: nothing happens")
    void noRows_noop() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of());

        sync.onConnectivityChanged("t1", "m1", true);

        verify(deviceSoftwareRepository, never()).save(any());
        verifyNoInteractions(softwareProjector, vulnerabilityProjector);
    }

    @Test
    @DisplayName("a null tenant or machine id touches nothing")
    void nullIds_noop() {
        sync.onConnectivityChanged(null, "m1", true);
        sync.onConnectivityChanged("t1", null, true);

        verifyNoInteractions(deviceSoftwareRepository, softwareProjector, vulnerabilityProjector);
    }
}
