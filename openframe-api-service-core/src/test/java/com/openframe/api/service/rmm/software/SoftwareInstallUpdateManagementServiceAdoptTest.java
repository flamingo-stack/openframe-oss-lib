package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceAdoptTest {

    private static final String TENANT = "t1";
    private static final String SOFTWARE_ID = "42";
    private static final String USER = "user-1";
    private static final String REQUEST_ID = "request-1";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String WINDOWS = "win-1";
    private static final String CASK = "postman";
    private static final String BUNDLE_ID = "com.postmanlabs.mac";
    private static final String CHOCO_PACKAGE = "googlechrome";
    private static final List<String> MACS = List.of(MAC, OTHER_MAC);
    private static final Set<OsType> MAC_OS = Set.of(OsType.MAC_OS);
    private static final Set<OsType> WINDOWS_OS = Set.of(OsType.WINDOWS);
    private static final Map<String, OsType> MAC_OS_TYPES = Map.of(MAC, OsType.MAC_OS, OTHER_MAC, OsType.MAC_OS);

    @Mock private SoftwareInventoryService softwareInventoryService;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private DeviceService deviceService;
    @Mock private PackageAdoptReach packageAdoptReach;
    @Mock private PackageUpdateDispatchService packageUpdateDispatchService;
    @Mock private SoftwareActionResultRepository softwareActionResultRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @Captor private ArgumentCaptor<RunningExecutionRows> rowsCaptor;
    @Captor private ArgumentCaptor<SoftwareActionResult> actionResultCaptor;

    @InjectMocks private SoftwareInstallUpdateManagementService service;

    private AdoptSoftwareInput macsInput;
    private SoftwareBundlePackage cask;
    private SoftwareResponse caskTitle;

    @BeforeEach
    void setUp() {
        macsInput = input(MACS);
        cask = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName(CASK)
                .brewPackageType(BrewPackageType.CASK)
                .build();
        caskTitle = title(cask, BUNDLE_ID);
    }

    @Test
    void adopt_titleWithABrewCask_oneAdoptRequestForTheDevicesWithTheCask() {
        // setup
        stubCaskAdoptableOnMacs();
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(macsInput, USER);

        // verifications
        verify(deviceService).verifyDispatchable(MACS);
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue())
                .extracting(RunningExecutionRows::getMachineIds, RunningExecutionRows::getPackageManager,
                        RunningExecutionRows::getPackageName, RunningExecutionRows::getSoftwareAction,
                        RunningExecutionRows::getInitiatedBy, RunningExecutionRows::getSource)
                .containsExactly(MACS, PackageManagerType.BREW, CASK, SoftwareAction.ADOPT, USER,
                        ExecutionSource.PACKAGE_INSTALLATION);
        assertThat(rowsCaptor.getValue().getExecutionId()).isNotBlank();
        assertThat(ordered).containsExactly(MAC, OTHER_MAC);
    }

    @Test
    void adopt_titleWithABrewCask_historyRowsCarryTheBrewAdoptIdOfNoScript() {
        // setup
        stubCaskAdoptableOnMacs();
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        service.adopt(macsInput, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue())
                .extracting(RunningExecutionRows::getScriptId, RunningExecutionRows::getPrivilegeLevel,
                        RunningExecutionRows::getTimeoutSeconds)
                .containsExactly(SoftwareScriptCode.BREW_ADOPT_SCRIPT_ID, PrivilegeLevel.USER, null);
    }

    @Test
    void adopt_orderSent_softwareActionsRowOfKindAdoptUnderTheHistoryExecution() {
        // setup
        stubCaskAdoptableOnMacs();
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        service.adopt(macsInput, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        verify(softwareActionResultRepository).save(actionResultCaptor.capture());
        assertThat(actionResultCaptor.getValue())
                .extracting(SoftwareActionResult::getTenantId, SoftwareActionResult::getExecutionId,
                        SoftwareActionResult::getAction, SoftwareActionResult::getKind,
                        SoftwareActionResult::getPackageManager, SoftwareActionResult::getPackageName,
                        SoftwareActionResult::getStatus, SoftwareActionResult::getMachineIds,
                        SoftwareActionResult::getTotalMachineCount, SoftwareActionResult::getInitiatedBy)
                .containsExactly(TENANT, rowsCaptor.getValue().getExecutionId(), SoftwareAction.ADOPT,
                        SoftwareActionKind.ADOPT, PackageManagerType.BREW, CASK, SoftwareActionStatus.IN_PROGRESS,
                        MACS, 2, USER);
    }

    @Test
    void adopt_titleWithAChocoPackage_chocoRequestWithTheChocoAdoptIdForHistory() {
        // setup
        List<String> machineIds = List.of(WINDOWS);
        Map<String, OsType> osTypes = Map.of(WINDOWS, OsType.WINDOWS);
        SoftwareBundlePackage chocoPackage = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.CHOCO)
                .packageName(CHOCO_PACKAGE)
                .build();
        AdoptSoftwareInput input = input(machineIds);
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(title(chocoPackage, null));
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, WINDOWS_OS)).thenReturn(machineIds);
        when(packageManagerAvailability.adoptableOn(machineIds, PackageManagerType.CHOCO)).thenReturn(machineIds);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, machineIds)).thenReturn(machineIds);
        when(packageAdoptReach.filterReachable(machineIds)).thenReturn(List.of(WINDOWS));
        stubAdoptDispatch(null, null);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(input, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(null), eq(SOFTWARE_ID), eq(null));
        assertThat(rowsCaptor.getValue())
                .extracting(RunningExecutionRows::getPackageManager, RunningExecutionRows::getPackageName,
                        RunningExecutionRows::getScriptId, RunningExecutionRows::getPrivilegeLevel)
                .containsExactly(PackageManagerType.CHOCO, CHOCO_PACKAGE, SoftwareScriptCode.CHOCO_ADOPT_SCRIPT_ID,
                        PrivilegeLevel.ADMIN);
        assertThat(ordered).containsExactly(WINDOWS);
    }

    @Test
    void adopt_deviceOfAnotherOsAmongTheGiven_leftOutAndTheRestOrdered() {
        // setup
        List<String> machineIds = List.of(MAC, WINDOWS);
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS, WINDOWS, OsType.WINDOWS);
        AdoptSoftwareInput input = input(machineIds);
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, macOnly)).thenReturn(macOnly);
        when(packageAdoptReach.filterReachable(macOnly)).thenReturn(List.of(MAC));
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(input, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly(MAC);
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_managerNotAdoptableOnADevice_leftOutAndTheRestOrdered() {
        // setup
        List<String> macOnly = List.of(MAC);
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(macOnly);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, macOnly)).thenReturn(macOnly);
        when(packageAdoptReach.filterReachable(macOnly)).thenReturn(List.of(MAC));
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(macsInput, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly(MAC);
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_sameDeviceGivenTwice_orderedOnce() {
        // setup
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS);
        AdoptSoftwareInput input = input(List.of(MAC, MAC));
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, macOnly)).thenReturn(macOnly);
        when(packageAdoptReach.filterReachable(macOnly)).thenReturn(List.of(MAC));
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(input, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly(MAC);
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_calledTwice_eachCallIsAnExecutionOfItsOwn() {
        // setup
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS);
        AdoptSoftwareInput input = input(macOnly);
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, macOnly)).thenReturn(macOnly);
        when(packageAdoptReach.filterReachable(macOnly)).thenReturn(List.of(MAC));
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        service.adopt(input, USER);
        service.adopt(input, USER);

        // verifications
        verify(packageUpdateDispatchService, times(2))
                .dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getAllValues())
                .extracting(RunningExecutionRows::getExecutionId)
                .doesNotContainNull()
                .doesNotHaveDuplicates()
                .hasSize(2);
    }

    @Test
    void adopt_titleWithoutAnAdoptionPackage_refusedAndNothingSent() {
        // setup
        BadRequestException noPackage = new BadRequestException("No package to adopt Postman into");
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenThrow(noPackage);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("No package to adopt Postman into");
        verifyNoInteractions(machinePlatformResolver, packageAdoptReach, deviceService, packageUpdateDispatchService);
    }

    @Test
    void adopt_adoptionPackageOfWinget_refusedAndNothingSent() {
        // setup
        SoftwareBundlePackage wingetPackage = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET)
                .packageName("Google.Chrome")
                .build();
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(title(wingetPackage, null));

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage())
                .isEqualTo("A program is not adopted into WINGET: winget updates it as it is installed");
        verifyNoInteractions(machinePlatformResolver, packageAdoptReach, deviceService, packageUpdateDispatchService);
    }

    @Test
    void adopt_noDeviceTheManagerCanAdoptOn_refusedAndNothingSent() {
        // setup
        Map<String, OsType> noOsTypes = Map.of();
        List<String> noMachines = List.of();
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(noOsTypes);
        when(machinePlatformResolver.compatible(MACS, noOsTypes, MAC_OS)).thenReturn(noMachines);
        when(packageManagerAvailability.adoptableOn(noMachines, PackageManagerType.BREW)).thenReturn(noMachines);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, noMachines)).thenReturn(noMachines);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("None of the given devices can adopt postman with BREW");
        verifyNoInteractions(packageAdoptReach, deviceService, packageUpdateDispatchService);
    }

    @Test
    void adopt_orderDoesNotReachADevice_thatDeviceLeftOutAndTheRestOrdered() {
        // setup
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, MACS)).thenReturn(MACS);
        when(packageAdoptReach.filterReachable(MACS)).thenReturn(List.of(OTHER_MAC));
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(macsInput, USER);

        // verifications
        verify(deviceService).verifyDispatchable(List.of(OTHER_MAC));
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly(OTHER_MAC);
        assertThat(ordered).containsExactly(OTHER_MAC);
    }

    @Test
    void adopt_deviceWhoseCopyIsOnlyInTheUsersApplicationsFolder_leftOutAndTheRestOrdered() {
        // setup
        List<String> otherMacOnly = List.of(OTHER_MAC);
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, MACS)).thenReturn(otherMacOnly);
        when(packageAdoptReach.filterReachable(otherMacOnly)).thenReturn(otherMacOnly);
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        List<String> ordered = service.adopt(macsInput, USER);

        // verifications
        verify(deviceService).verifyDispatchable(otherMacOnly);
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(rowsCaptor.getValue().getMachineIds()).containsExactly(OTHER_MAC);
        assertThat(ordered).containsExactly(OTHER_MAC);
    }

    @Test
    void adopt_everyCopyOnlyInTheUsersApplicationsFolder_refusedAndNothingSent() {
        // setup
        List<String> noMachines = List.of();
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, MACS)).thenReturn(noMachines);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("None of the given devices can adopt postman with BREW");
        verifyNoInteractions(packageAdoptReach, deviceService, packageUpdateDispatchService);
    }

    @Test
    void adopt_orderReachesNoDevice_refusedAndNothingSent() {
        // setup
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, MACS)).thenReturn(MACS);
        when(packageAdoptReach.filterReachable(MACS)).thenReturn(List.of());

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("The adopt order reaches none of the given devices: "
                + "PACKAGE_ADOPT is switched off or their agent is too old for it");
        verifyNoInteractions(deviceService, packageUpdateDispatchService, softwareActionResultRepository);
    }

    @Test
    void adopt_titleWithABundleIdentifier_orderCarriesIt() {
        // setup
        stubCaskAdoptableOnMacs();
        stubAdoptDispatch(BrewPackageType.CASK, BUNDLE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        service.adopt(macsInput, USER);

        // verifications
        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK), eq(SOFTWARE_ID), eq(BUNDLE_ID));
    }

    @Test
    void adopt_deviceNotManaged_refusedAndNothingSent() {
        // setup
        BadRequestException notManaged = new BadRequestException("Machine is not in a dispatchable state: mac-2");
        stubCaskAdoptableOnMacs();
        doThrow(notManaged).when(deviceService).verifyDispatchable(MACS);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput, USER));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Machine is not in a dispatchable state: mac-2");
        verifyNoInteractions(packageUpdateDispatchService, softwareActionResultRepository);
    }

    private void stubCaskAdoptableOnMacs() {
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(caskTitle);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutUserApplicationsOnlyCopies(SOFTWARE_ID, MACS)).thenReturn(MACS);
        when(packageAdoptReach.filterReachable(MACS)).thenReturn(List.of(MAC, OTHER_MAC));
    }

    private void stubAdoptDispatch(BrewPackageType brewPackageType, String bundleId) {
        when(packageUpdateDispatchService.dispatchAdopt(any(RunningExecutionRows.class), eq(brewPackageType),
                eq(SOFTWARE_ID), eq(bundleId))).thenReturn(REQUEST_ID);
    }

    private static SoftwareResponse title(SoftwareBundlePackage adoptionPackage, String bundleIdentifier) {
        SoftwareResponse title = new SoftwareResponse();
        title.setId(SOFTWARE_ID);
        title.setName("Postman");
        title.setBundleIdentifier(bundleIdentifier);
        title.setAdoptionPackage(adoptionPackage);
        return title;
    }

    private static AdoptSoftwareInput input(List<String> machineIds) {
        AdoptSoftwareInput input = new AdoptSoftwareInput();
        input.setSoftwareId(SOFTWARE_ID);
        input.setMachineIds(machineIds);
        return input;
    }
}
