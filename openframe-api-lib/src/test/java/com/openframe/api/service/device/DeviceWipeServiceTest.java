package com.openframe.api.service.device;

import com.openframe.api.dto.device.DeviceWipe;
import com.openframe.api.dto.device.DeviceWipeStatus;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.rmm.fleet.FleetMdmClientProvider;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostDeviceStatus;
import com.openframe.sdk.fleetmdm.model.HostMdm;
import com.openframe.sdk.fleetmdm.model.HostPendingAction;
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
import static org.mockito.Mockito.doThrow;
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
    void wipe_managedWindowsDeviceOnFleet_requestsProtectedWipeAndReportsPending() {
        // setup
        givenDeviceOnHost(machine(DeviceStatus.MANAGED, OsType.WINDOWS));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);

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
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.DELETED, OsType.WINDOWS)));

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipe_macDevice_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.MANAGED, OsType.MAC_OS)));

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipe_deviceWithoutFleetConnection_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.MANAGED, OsType.WINDOWS)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @ParameterizedTest
    @ValueSource(ints = {402, 404, 422})
    void wipe_fleetRefusesRequest_badRequest(int status) {
        // setup
        givenFleetAnswersWipe(status);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void wipe_hostAlreadyWiped_conflict() {
        // setup
        givenFleetAnswersWipe(409);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isInstanceOf(ConflictException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {500, 599})
    void wipe_fleetServerError_propagatesFleetException(int status) {
        // setup
        FleetMdmApiException failure = givenFleetAnswersWipe(status);

        // execution / verifications
        assertThatThrownBy(() -> service.wipe(MACHINE_ID)).isSameAs(failure);
    }

    @Test
    void getWipe_windowsHostInFleetMdmWithNothingPending_available() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.UNLOCKED, HostPendingAction.NONE)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isTrue();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_pendingActionAbsent_readAsNothingPending() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.UNLOCKED, null)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isTrue();
    }

    @Test
    void getWipe_pendingWipe_pendingAndUnavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.UNLOCKED, HostPendingAction.WIPE)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.PENDING);
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_wipedHost_wipedAndUnavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.WIPED, HostPendingAction.NONE)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.WIPED);
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_pendingLock_unavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.UNLOCKED, HostPendingAction.LOCK)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_lockedHost_unavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(true, HostDeviceStatus.LOCKED, HostPendingAction.NONE)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
        assertThat(result.getStatus()).isEqualTo(DeviceWipeStatus.NOT_REQUESTED);
    }

    @Test
    void getWipe_hostNotInFleetMdm_unavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(mdm(false, HostDeviceStatus.UNLOCKED, HostPendingAction.NONE)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result.isAvailable()).isFalse();
    }

    @Test
    void getWipe_hostWithoutMdmSection_unavailable() {
        // setup
        givenWindowsDeviceWithHost(windowsHost(null));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_hostMissingInFleet_unavailable() {
        // setup
        givenWindowsDeviceWithHost(null);

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_fleetUnreachable_unavailable() {
        // setup
        givenDeviceOnHost(machine(DeviceStatus.MANAGED, OsType.WINDOWS));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        when(fleet.getHostById(HOST_ID)).thenThrow(new FleetMdmApiException("down", 503, ""));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
    }

    @Test
    void getWipe_macDevice_unavailableWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.MANAGED, OsType.MAC_OS)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void getWipe_archivedDevice_unavailableWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.ARCHIVED, OsType.WINDOWS)));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void getWipe_nonNumericFleetAgentId_unavailableWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID))
                .thenReturn(Optional.of(machine(DeviceStatus.MANAGED, OsType.WINDOWS)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection("4C4C4544-0044-3510-8052-B4C04F4B4E33")));

        // execution
        DeviceWipe result = service.getWipe(MACHINE_ID);

        // verifications
        assertThat(result).isEqualTo(DeviceWipe.unavailable());
        verifyNoInteractions(fleetMdmClientProvider);
    }

    private FleetMdmApiException givenFleetAnswersWipe(int status) {
        givenDeviceOnHost(machine(DeviceStatus.MANAGED, OsType.WINDOWS));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        FleetMdmApiException failure = new FleetMdmApiException("refused", status, "{}");
        doThrow(failure).when(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
        return failure;
    }

    private void givenWindowsDeviceWithHost(Host host) {
        givenDeviceOnHost(machine(DeviceStatus.MANAGED, OsType.WINDOWS));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        when(fleet.getHostById(HOST_ID)).thenReturn(host);
    }

    private void givenDeviceOnHost(Machine machine) {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection(String.valueOf(HOST_ID))));
    }

    private static Machine machine(DeviceStatus status, OsType osType) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setStatus(status);
        machine.setOsType(osType);
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

    private static HostMdm mdm(boolean connectedToFleet, HostDeviceStatus deviceStatus, HostPendingAction pendingAction) {
        HostMdm mdm = new HostMdm();
        mdm.setConnectedToFleet(connectedToFleet);
        mdm.setDeviceStatus(deviceStatus);
        mdm.setPendingAction(pendingAction);
        return mdm;
    }
}
