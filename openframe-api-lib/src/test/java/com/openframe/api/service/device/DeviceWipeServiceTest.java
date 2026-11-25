package com.openframe.api.service.device;

import com.openframe.api.dto.device.DeviceWipe;
import com.openframe.api.dto.device.DeviceWipeStatus;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostMdm;
import com.openframe.sdk.fleetmdm.model.WindowsWipeType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceWipeServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final long HOST_ID = 42L;

    @Mock private DeviceService deviceService;
    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private FleetMdmClientProvider fleetMdmClientProvider;
    @Mock private FleetMdmClient fleet;

    @InjectMocks
    private DeviceWipeService service;

    @Test
    void wipe_windowsHostInFleetMdm_requestsProtectedWipeAndReportsPending() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", null)));

        // execution
        DeviceWipe result = service.wipe(MACHINE_ID);

        // verifications
        verify(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.PENDING);
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void wipe_unknownDevice_throwsNotFound() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(DeviceNotFoundException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipe_deletedDevice_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(DeviceStatus.DELETED)));

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipe_deviceWithoutFleetConnection_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(DeviceStatus.MANAGED)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipe_hostMissingInFleet_refused() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(null);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verify(fleet, never()).wipeHost(anyLong(), any());
    }

    @Test
    void wipe_macHost_refusedWithoutWipeCall() {
        // setup
        givenManagedDeviceOnHost();
        Host host = windowsHost(mdm(true, "unlocked", null));
        host.setPlatform("darwin");
        givenHost(host);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verify(fleet, never()).wipeHost(anyLong(), any());
    }

    @ParameterizedTest
    @ValueSource(ints = {402, 422})
    void wipe_fleetRefusesRequest_badRequest(int status) {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", null)));
        doThrow(new FleetMdmApiException("refused", status, "{}"))
                .when(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void wipe_hostAlreadyWiped_conflict() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", null)));
        doThrow(new FleetMdmApiException("wiped", 409, "{}"))
                .when(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(ConflictException.class);
    }

    @Test
    void wipe_fleetServerError_propagatesFleetException() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", null)));
        FleetMdmApiException failure = new FleetMdmApiException("boom", 500, "{}");
        doThrow(failure).when(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isSameAs(failure);
    }

    @Test
    void getWipe_windowsHostInFleetMdmWithNothingPending_available() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", null)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isTrue();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_pendingWipe_pendingAndUnavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", "wipe")));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.PENDING);
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_wipedHost_wipedAndUnavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "wiped", null)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.WIPED);
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_pendingLock_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "unlocked", "lock")));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_lockedHost_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(true, "locked", null)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_fleetUnreachable_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        when(fleet.getHostById(HOST_ID)).thenThrow(new FleetMdmApiException("down", 503, ""));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_hostMissingInFleet_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(null);

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_hostNotInFleetMdm_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(mdm(false, "unlocked", null)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_hostWithoutMdmSection_unavailable() {
        // setup
        givenManagedDeviceOnHost();
        givenHost(windowsHost(null));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_archivedDevice_unavailableWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(DeviceStatus.ARCHIVED)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void getWipe_nonNumericFleetAgentId_unavailableWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(DeviceStatus.MANAGED)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection("4C4C4544-0044-3510-8052-B4C04F4B4E33")));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
        verifyNoInteractions(fleetMdmClientProvider);
    }

    private void givenManagedDeviceOnHost() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine(DeviceStatus.MANAGED)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection(String.valueOf(HOST_ID))));
    }

    private void givenHost(Host host) {
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        when(fleet.getHostById(HOST_ID)).thenReturn(host);
    }

    private static Machine machine(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(status);
        return machine;
    }

    private static ToolConnection connection(String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(MACHINE_ID);
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setAgentToolId(agentToolId);
        return connection;
    }

    private static Host windowsHost(HostMdm mdm) {
        Host host = new Host();
        host.setId(HOST_ID);
        host.setPlatform("windows");
        host.setMdm(mdm);
        return host;
    }

    private static HostMdm mdm(boolean connectedToFleet, String deviceStatus, String pendingAction) {
        HostMdm mdm = new HostMdm();
        mdm.setConnectedToFleet(connectedToFleet);
        mdm.setDeviceStatus(deviceStatus);
        mdm.setPendingAction(pendingAction);
        return mdm;
    }
}
