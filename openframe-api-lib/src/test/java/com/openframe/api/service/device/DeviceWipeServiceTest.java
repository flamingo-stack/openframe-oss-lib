package com.openframe.api.service.device;

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
    private static final String HOSTNAME = "DESKTOP-7Q2K9";
    private static final long HOST_ID = 42L;

    @Mock private DeviceService deviceService;
    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private FleetMdmClientProvider fleetMdmClientProvider;
    @Mock private FleetMdmClient fleet;

    @InjectMocks
    private DeviceWipeService service;

    @Test
    void wipeWindowsDevice_confirmedManagedWindowsDevice_requestsProtectedWipe() {
        // setup
        Machine machine = windowsMachine(DeviceStatus.MANAGED);
        givenDeviceOnHost(machine);
        when(fleetMdmClientProvider.client()).thenReturn(fleet);

        // execution
        Machine result = service.wipeWindowsDevice(MACHINE_ID, HOSTNAME);

        // verifications
        verify(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
        assertThat(result).isSameAs(machine);
    }

    @Test
    void wipeWindowsDevice_confirmationWithSurroundingSpaces_accepted() {
        // setup
        givenDeviceOnHost(windowsMachine(DeviceStatus.MANAGED));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);

        // execution
        service.wipeWindowsDevice(MACHINE_ID, "  " + HOSTNAME + " ");

        // verifications
        verify(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
    }

    @Test
    void wipeWindowsDevice_confirmationMatchesNickname_accepted() {
        // setup
        Machine machine = windowsMachine(DeviceStatus.MANAGED);
        machine.setNickname("Reception PC");
        givenDeviceOnHost(machine);
        when(fleetMdmClientProvider.client()).thenReturn(fleet);

        // execution
        service.wipeWindowsDevice(MACHINE_ID, "Reception PC");

        // verifications
        verify(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
    }

    @Test
    void wipeWindowsDevice_confirmationOfAnotherName_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(windowsMachine(DeviceStatus.MANAGED)));

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, "desktop-7q2k9"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("The confirmation does not match the device's name");
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipeWindowsDevice_unknownDevice_throwsNotFound() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(DeviceNotFoundException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipeWindowsDevice_deletedDevice_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(windowsMachine(DeviceStatus.DELETED)));

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipeWindowsDevice_macDevice_refusedWithoutCallingFleet() {
        // setup
        Machine mac = windowsMachine(DeviceStatus.MANAGED);
        mac.setOsType(OsType.MAC_OS);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(mac));

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipeWindowsDevice_deviceWithoutFleetConnection_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(windowsMachine(DeviceStatus.MANAGED)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @Test
    void wipeWindowsDevice_nonNumericFleetAgentId_refusedWithoutCallingFleet() {
        // setup
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(windowsMachine(DeviceStatus.MANAGED)));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection("4C4C4544-0044-3510-8052-B4C04F4B4E33")));

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(fleetMdmClientProvider);
    }

    @ParameterizedTest
    @ValueSource(ints = {402, 404, 422})
    void wipeWindowsDevice_fleetRefusesRequest_badRequest(int status) {
        // setup
        givenFleetAnswersWipe(status);

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void wipeWindowsDevice_hostAlreadyWiped_conflict() {
        // setup
        givenFleetAnswersWipe(409);

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME))
                .isInstanceOf(ConflictException.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {500, 599})
    void wipeWindowsDevice_fleetServerError_propagatesFleetException(int status) {
        // setup
        FleetMdmApiException failure = givenFleetAnswersWipe(status);

        // execution / verifications
        assertThatThrownBy(() -> service.wipeWindowsDevice(MACHINE_ID, HOSTNAME)).isSameAs(failure);
    }

    private FleetMdmApiException givenFleetAnswersWipe(int status) {
        givenDeviceOnHost(windowsMachine(DeviceStatus.MANAGED));
        when(fleetMdmClientProvider.client()).thenReturn(fleet);
        FleetMdmApiException failure = new FleetMdmApiException("refused", status, "{}");
        doThrow(failure).when(fleet).wipeHost(HOST_ID, WindowsWipeType.DO_WIPE_PROTECTED);
        return failure;
    }

    private void givenDeviceOnHost(Machine machine) {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(connection(String.valueOf(HOST_ID))));
    }

    private static Machine windowsMachine(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setHostname(HOSTNAME);
        machine.setStatus(status);
        machine.setOsType(OsType.WINDOWS);
        return machine;
    }

    private static ToolConnection connection(String agentToolId) {
        ToolConnection connection = new ToolConnection();
        connection.setMachineId(MACHINE_ID);
        connection.setToolType(ToolType.FLEET_MDM);
        connection.setAgentToolId(agentToolId);
        return connection;
    }
}
