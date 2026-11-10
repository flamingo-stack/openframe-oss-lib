package com.openframe.data.service.rmm;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeletedMachineCleanupTest {

    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private DeviceOnlineDispatchRepository onlineDeviceDispatchRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjectionTrigger projectionTrigger;

    @InjectMocks private DeletedMachineCleanup cleanup;

    @Test
    @DisplayName("deletes the machine's schedule assignments and first-online dispatch records")
    void removesAssignmentsAndDispatch() {
        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(assignedRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(onlineDeviceDispatchRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
    }

    @Test
    @DisplayName("a missing tenant or machine id touches nothing")
    void missingIds_noop() {
        cleanup.cleanUpDeletedMachine(null, "m-1");
        cleanup.cleanUpDeletedMachine("t-1", null);

        verifyNoInteractions(assignedRepository, onlineDeviceDispatchRepository,
                deviceSoftwareRepository, projectionTrigger);
    }

    @Test
    @DisplayName("drops the device's software rows and re-projects every title and CVE it touched")
    void removesSoftwareRowsAndReprojects() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of(
                DeviceSoftware.builder().machineId("m-1").softwareTitleId(42L)
                        .vulnerabilities(List.of("CVE-1", "CVE-2")).build(),
                DeviceSoftware.builder().machineId("m-1").softwareTitleId(99L)
                        .vulnerabilities(List.of("CVE-1")).build()));  // CVE-1 shared across titles

        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(deviceSoftwareRepository).deleteByTenantIdAndMachineId("t-1", "m-1");
        verify(projectionTrigger).titlesChanged("t-1", Set.of(42L, 99L));
        verify(projectionTrigger).cvesChanged("t-1", Set.of("CVE-1", "CVE-2"));
    }

    @Test
    @DisplayName("no software rows: nothing is deleted or re-projected")
    void noSoftwareRows_noReprojection() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t-1", "m-1")).thenReturn(List.of());

        cleanup.cleanUpDeletedMachine("t-1", "m-1");

        verify(deviceSoftwareRepository).findByTenantIdAndMachineId("t-1", "m-1");
        verifyNoInteractions(projectionTrigger);
    }
}
