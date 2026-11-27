package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.service.device.DeviceService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.nats.delivery.PackageAdoptReach;
import com.openframe.data.nats.packageupdate.PackageUpdateDispatchService;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceAuditTest {

    private static final String SOFTWARE_ID = "42";
    private static final String USER = "user-1";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String CASK = "postman";
    private static final String BUNDLE_ID = "com.postmanlabs.mac";
    private static final List<String> MACS = List.of(MAC, OTHER_MAC);
    private static final Map<String, OsType> MAC_OS_TYPES = Map.of(MAC, OsType.MAC_OS, OTHER_MAC, OsType.MAC_OS);

    @Mock private SoftwareInventoryService softwareInventoryService;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private PackageAdoptReach packageAdoptReach;
    @Mock private DeviceService deviceService;
    @Mock private PackageUpdateDispatchService packageUpdateDispatchService;
    @Mock private SoftwareActionResultRepository softwareActionResultRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SoftwareInstallUpdateManagementService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<RunningExecutionRows> rowsCaptor;

    private Object ordered;

    @Test
    void adopt_sameDeviceGivenTwice_eventTargetsThatDevice() {
        service.adopt(input(List.of(MAC, MAC)), USER);

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo(MAC);
    }

    @Test
    void adopt_oneDevice_eventStoredWithoutComparingTheUnchangedDeviceRecord() {
        service.adopt(input(List.of(MAC)), USER);

        assertThat(capturedCall().compare()).isFalse();
    }

    @Test
    void adopt_orderReachesOneOfTwoDevices_eventTargetsTheReachedDevice() {
        stubCaskOnMacsReaching(List.of(OTHER_MAC));
        runTheWork();

        service.adopt(input(MACS), USER);

        AuditCall call = capturedCall();
        assertThat(call.targetIdBeforeCall().get()).isNull();
        assertThat(call.targetIdFromResult().apply(ordered)).isEqualTo(OTHER_MAC);
    }

    @Test
    void adopt_orderReachesOneOfTwoDevices_detailsNameOnlyTheReachedDeviceAndItsExecution() {
        stubCaskOnMacsReaching(List.of(OTHER_MAC));
        runTheWork();

        service.adopt(input(MACS), USER);

        verify(packageUpdateDispatchService).dispatchAdopt(rowsCaptor.capture(), eq(BrewPackageType.CASK),
                eq(SOFTWARE_ID), eq(BUNDLE_ID));
        assertThat(capturedCall().detailsFromResult().apply(ordered)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "softwareIds", List.of(SOFTWARE_ID),
                "packages", List.of(CASK),
                "machineIds", List.of(OTHER_MAC),
                "executionIds", List.of(rowsCaptor.getValue().getExecutionId())));
    }

    @Test
    void adopt_orderReachesBothDevices_eventHasNoSingleTarget() {
        stubCaskOnMacsReaching(MACS);
        runTheWork();

        service.adopt(input(MACS), USER);

        AuditCall call = capturedCall();
        assertThat(call.targetIdBeforeCall().get()).isNull();
        assertThat(call.targetIdFromResult().apply(ordered)).isNull();
    }

    @Test
    void adopt_wingetPackage_refusedEventKeepsTheProgramItsPackageAndTheAskedDevices() {
        SoftwareBundlePackage winget = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET)
                .packageName("Google.Chrome")
                .build();
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(title(winget, null));
        runTheWork();

        assertThatThrownBy(() -> service.adopt(input(MACS), USER))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("A program is not adopted into WINGET: winget updates it as it is installed");

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "softwareIds", List.of(SOFTWARE_ID),
                "packages", List.of("Google.Chrome"),
                "machineIds", MACS));
    }

    private void stubCaskOnMacsReaching(List<String> reached) {
        SoftwareBundlePackage cask = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName(CASK)
                .brewPackageType(BrewPackageType.CASK)
                .build();
        when(softwareInventoryService.getAdoptableSoftware(SOFTWARE_ID)).thenReturn(title(cask, BUNDLE_ID));
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, Set.of(OsType.MAC_OS))).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(softwareInventoryService.withoutCopiesNotToAdopt(SOFTWARE_ID, cask, MACS)).thenReturn(MACS);
        when(packageAdoptReach.filterReachable(MACS)).thenReturn(reached);
    }

    private void runTheWork() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            AuditedWork<?, ?> work = invocation.getArgument(1);
            ordered = work.run();
            return ordered;
        });
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static SoftwareResponse title(SoftwareBundlePackage adoptionPackage, String bundleIdentifier) {
        SoftwareResponse title = new SoftwareResponse();
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
