package com.openframe.api.service.packageinstall;

import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.packageinstall.InstallPackageInput;
import com.openframe.api.dto.packageinstall.UninstallPackageInput;
import com.openframe.api.dto.packagesearch.PackageDetails;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.packagesearch.PackageSearchService;
import com.openframe.api.service.rmm.command.CommandDispatchService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptShell;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackageInstallServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String USER_ID = "user-1";

    private DeviceService deviceService;
    private PackageSearchService packageSearchService;
    private PackageInstallScriptBuilder scriptBuilder;
    private CommandDispatchService commandDispatchService;
    private PackageInstallService service;

    @BeforeEach
    void setUp() {
        deviceService = mock(DeviceService.class);
        packageSearchService = mock(PackageSearchService.class);
        scriptBuilder = mock(PackageInstallScriptBuilder.class);
        commandDispatchService = mock(CommandDispatchService.class);
        service = new PackageInstallService(deviceService, packageSearchService, scriptBuilder, commandDispatchService);
    }

    @Test
    void installDispatchesResolvedScriptToTheMachine() {
        givenMachine(OsType.MAC_OS);
        PackageDetails details = details(PackageManagerType.BREW, "slack");
        when(packageSearchService.findPackage(PackageManagerType.BREW, "slack", BrewPackageType.CASK))
                .thenReturn(details);
        PackageScript script = new PackageScript("script-code", ScriptShell.BASH, PrivilegeLevel.USER);
        when(scriptBuilder.buildInstallScript(details, null)).thenReturn(script);
        DispatchResponse dispatched = DispatchResponse.builder().executionId("exec-1").build();
        when(commandDispatchService.batchRunCommand(any(), anyString())).thenReturn(dispatched);

        DispatchResponse response = service.install(installInput(PackageManagerType.BREW, "slack", BrewPackageType.CASK, null), USER_ID);

        assertEquals("exec-1", response.getExecutionId());
        ArgumentCaptor<BatchRunCommandInput> command = ArgumentCaptor.forClass(BatchRunCommandInput.class);
        verify(commandDispatchService).batchRunCommand(command.capture(), eq(USER_ID));
        assertEquals(List.of(MACHINE_ID), command.getValue().getMachineIds());
        assertEquals("script-code", command.getValue().getCommand());
        assertEquals(ScriptShell.BASH, command.getValue().getShell());
        assertEquals(PrivilegeLevel.USER, command.getValue().getPrivilegeLevel());
        assertEquals(600, command.getValue().getTimeoutSeconds());
    }

    @Test
    void installRejectsManagerOsMismatch() {
        givenMachine(OsType.WINDOWS);

        InstallPackageInput input = installInput(PackageManagerType.BREW, "slack", null, null);

        assertThrows(IllegalArgumentException.class, () -> service.install(input, USER_ID));
        verify(commandDispatchService, never()).batchRunCommand(any(), anyString());
    }

    @Test
    void installRejectsVersionForBrew() {
        InstallPackageInput input = installInput(PackageManagerType.BREW, "slack", null, "4.52.155");

        assertThrows(IllegalArgumentException.class, () -> service.install(input, USER_ID));
        verify(commandDispatchService, never()).batchRunCommand(any(), anyString());
    }

    @Test
    void installRejectsUnknownMachine() {
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        InstallPackageInput input = installInput(PackageManagerType.BREW, "slack", null, null);

        assertThrows(DeviceNotFoundException.class, () -> service.install(input, USER_ID));
    }

    @Test
    void uninstallDispatchesUninstallScript() {
        givenMachine(OsType.WINDOWS);
        PackageDetails details = details(PackageManagerType.CHOCO, "7zip");
        when(packageSearchService.findPackage(PackageManagerType.CHOCO, "7zip", null)).thenReturn(details);
        PackageScript script = new PackageScript("uninstall-code", ScriptShell.POWERSHELL, PrivilegeLevel.ADMIN);
        when(scriptBuilder.buildUninstallScript(details)).thenReturn(script);
        DispatchResponse dispatched = DispatchResponse.builder().executionId("exec-2").build();
        when(commandDispatchService.batchRunCommand(any(), anyString())).thenReturn(dispatched);

        UninstallPackageInput input = new UninstallPackageInput();
        input.setMachineId(MACHINE_ID);
        input.setPackageManager(PackageManagerType.CHOCO);
        input.setPackageId("7zip");

        DispatchResponse response = service.uninstall(input, USER_ID);

        assertEquals("exec-2", response.getExecutionId());
        ArgumentCaptor<BatchRunCommandInput> command = ArgumentCaptor.forClass(BatchRunCommandInput.class);
        verify(commandDispatchService).batchRunCommand(command.capture(), anyString());
        assertEquals("uninstall-code", command.getValue().getCommand());
        assertEquals(PrivilegeLevel.ADMIN, command.getValue().getPrivilegeLevel());
    }

    private void givenMachine(OsType osType) {
        Machine machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setOsType(osType);
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }

    private static InstallPackageInput installInput(PackageManagerType manager, String packageId,
                                                    BrewPackageType packageType, String version) {
        InstallPackageInput input = new InstallPackageInput();
        input.setMachineId(MACHINE_ID);
        input.setPackageManager(manager);
        input.setPackageId(packageId);
        input.setPackageType(packageType);
        input.setVersion(version);
        return input;
    }

    private static PackageDetails details(PackageManagerType manager, String id) {
        return PackageDetails.builder()
                .id(id)
                .packageManager(manager)
                .build();
    }
}
