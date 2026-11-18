package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.nats.delivery.PackageAdoptDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.data.service.rmm.software.PackageManagerAvailability;
import com.openframe.delivery.spec.DeliverySeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceAdoptTest {

    private static final String TENANT = "t1";
    private static final String SOFTWARE_ID = "42";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String WINDOWS = "win-1";
    private static final String CASK = "postman";
    private static final String CHOCO_PACKAGE = "googlechrome";
    private static final List<String> MACS = List.of(MAC, OTHER_MAC);
    private static final Set<OsType> MAC_OS = Set.of(OsType.MAC_OS);
    private static final Set<OsType> WINDOWS_OS = Set.of(OsType.WINDOWS);
    private static final Map<String, OsType> MAC_OS_TYPES = Map.of(MAC, OsType.MAC_OS, OTHER_MAC, OsType.MAC_OS);

    @Mock private SoftwareInventoryService softwareInventoryService;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private PackageManagerAvailability packageManagerAvailability;
    @Mock private DeviceService deviceService;
    @Mock private DeliveryRouter deliveryRouter;
    @Mock private SoftwareAdoptionRepository softwareAdoptionRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @Captor private ArgumentCaptor<PackageAdoptDeliverySeed> seedCaptor;
    @Captor private ArgumentCaptor<List<SoftwareAdoption>> adoptionsCaptor;

    @InjectMocks private SoftwareInstallUpdateManagementService service;

    private AdoptSoftwareInput macsInput;
    private SoftwareBundlePackage cask;

    @BeforeEach
    void setUp() {
        macsInput = input(MACS);
        cask = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName(CASK)
                .brewPackageType(BrewPackageType.CASK)
                .build();
    }

    @Test
    void adopt_titleWithABrewCask_caskOrderOfOneRequestSentToEachDevice() {
        // setup
        stubCaskAdoptableOnMacs();
        PackageReference caskRef = PackageReference.builder()
                .manager(PackageManagerType.BREW)
                .kind(BrewPackageType.CASK)
                .name(CASK)
                .build();

        // execution
        List<String> ordered = service.adopt(macsInput);

        // verifications
        verify(deviceService).verifyDispatchable(MACS);
        verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getType, PackageAdoptDeliverySeed::getMachineId,
                        PackageAdoptDeliverySeed::getPackageRef)
                .containsExactly(tuple(DeliveryType.PACKAGE_ADOPT, MAC, caskRef),
                        tuple(DeliveryType.PACKAGE_ADOPT, OTHER_MAC, caskRef));
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getRequestId)
                .doesNotContainNull()
                .containsOnly(seedCaptor.getValue().getRequestId());
        assertThat(ordered).containsExactly(MAC, OTHER_MAC);
    }

    @Test
    void adopt_orderSent_adoptingRecordPerDeviceSavedBeforeTheOrderLeaves() {
        // setup
        stubCaskAdoptableOnMacs();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        InOrder recordThenOrder = inOrder(softwareAdoptionRepository, deliveryRouter);

        // execution
        service.adopt(macsInput);

        // verifications
        recordThenOrder.verify(softwareAdoptionRepository).saveAll(adoptionsCaptor.capture());
        recordThenOrder.verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        assertThat(adoptionsCaptor.getValue())
                .extracting(SoftwareAdoption::getId, SoftwareAdoption::getTenantId, SoftwareAdoption::getMachineId,
                        SoftwareAdoption::getSoftwareId, SoftwareAdoption::getPackageManager,
                        SoftwareAdoption::getPackageName, SoftwareAdoption::getStatus)
                .containsExactly(
                        tuple("mac-1:42", TENANT, MAC, SOFTWARE_ID, PackageManagerType.BREW, CASK, SoftwareAdoptionStatus.ADOPTING),
                        tuple("mac-2:42", TENANT, OTHER_MAC, SOFTWARE_ID, PackageManagerType.BREW, CASK, SoftwareAdoptionStatus.ADOPTING));
        assertThat(adoptionsCaptor.getValue())
                .extracting(SoftwareAdoption::getRequestId)
                .containsOnly(seedCaptor.getValue().getRequestId());
        assertThat(adoptionsCaptor.getValue())
                .extracting(SoftwareAdoption::getCreatedAt)
                .doesNotContainNull();
    }

    @Test
    void adopt_titleWithAChocoPackage_orderCarriesThePackageIdToTheWindowsDevice() {
        // setup
        List<String> machineIds = List.of(WINDOWS);
        Map<String, OsType> osTypes = Map.of(WINDOWS, OsType.WINDOWS);
        SoftwareBundlePackage chocoPackage = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.CHOCO)
                .packageName(CHOCO_PACKAGE)
                .build();
        PackageReference chocoRef = PackageReference.builder()
                .manager(PackageManagerType.CHOCO)
                .id(CHOCO_PACKAGE)
                .build();
        AdoptSoftwareInput input = input(machineIds);
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(chocoPackage);
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, WINDOWS_OS)).thenReturn(machineIds);
        when(packageManagerAvailability.adoptableOn(machineIds, PackageManagerType.CHOCO)).thenReturn(machineIds);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, machineIds)).thenReturn(Set.of(WINDOWS));

        // execution
        List<String> ordered = service.adopt(input);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getPackageRef()).isEqualTo(chocoRef);
        assertThat(ordered).containsExactly(WINDOWS);
    }

    @Test
    void adopt_deviceOfAnotherOsAmongTheGiven_leftOutAndTheRestOrdered() {
        // setup
        List<String> machineIds = List.of(MAC, WINDOWS);
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS, WINDOWS, OsType.WINDOWS);
        AdoptSoftwareInput input = input(machineIds);
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, macOnly)).thenReturn(Set.of(MAC));

        // execution
        List<String> ordered = service.adopt(input);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MAC);
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_managerNotAdoptableOnADevice_leftOutAndTheRestOrdered() {
        // setup
        List<String> macOnly = List.of(MAC);
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(macOnly);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, macOnly)).thenReturn(Set.of(MAC));

        // execution
        List<String> ordered = service.adopt(macsInput);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getMachineId()).isEqualTo(MAC);
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_sameDeviceGivenTwice_orderedOnce() {
        // setup
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS);
        AdoptSoftwareInput input = input(List.of(MAC, MAC));
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, macOnly)).thenReturn(Set.of(MAC));

        // execution
        List<String> ordered = service.adopt(input);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(ordered).containsExactly(MAC);
    }

    @Test
    void adopt_calledTwice_eachCallIsARequestOfItsOwn() {
        // setup
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS);
        AdoptSoftwareInput input = input(macOnly);
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
        when(packageManagerAvailability.adoptableOn(macOnly, PackageManagerType.BREW)).thenReturn(macOnly);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, macOnly)).thenReturn(Set.of(MAC));

        // execution
        service.adopt(input);
        service.adopt(input);

        // verifications
        verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getTargetId)
                .doesNotContainNull()
                .doesNotHaveDuplicates()
                .hasSize(2);
    }

    @Test
    void adopt_titleWithoutAnAdoptionPackage_refusedAndNothingSent() {
        // setup
        BadRequestException noPackage = new BadRequestException("No package to adopt Postman into");
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenThrow(noPackage);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("No package to adopt Postman into");
        verifyNoInteractions(machinePlatformResolver, deliveryRouter, deviceService, softwareAdoptionRepository);
    }

    @Test
    void adopt_adoptionPackageOfWinget_refusedAndNothingSent() {
        // setup
        SoftwareBundlePackage wingetPackage = SoftwareBundlePackage.builder()
                .packageManager(PackageManagerType.WINGET)
                .packageName("Google.Chrome")
                .build();
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(wingetPackage);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput));

        // verifications
        assertThat(refused.getMessage())
                .isEqualTo("A program is not adopted into WINGET: winget updates it as it is installed");
        verifyNoInteractions(machinePlatformResolver, deliveryRouter, deviceService, softwareAdoptionRepository);
    }

    @Test
    void adopt_noDeviceTheManagerCanAdoptOn_refusedAndNothingSent() {
        // setup
        Map<String, OsType> noOsTypes = Map.of();
        List<String> noMachines = List.of();
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(noOsTypes);
        when(machinePlatformResolver.compatible(MACS, noOsTypes, MAC_OS)).thenReturn(noMachines);
        when(packageManagerAvailability.adoptableOn(noMachines, PackageManagerType.BREW)).thenReturn(noMachines);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("None of the given devices can adopt postman with BREW");
        verifyNoInteractions(deliveryRouter, deviceService, softwareAdoptionRepository);
    }

    @Test
    void adopt_orderDoesNotReachADevice_refusedAndNothingSent() {
        // setup
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, MACS)).thenReturn(Set.of(MAC));

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput));

        // verifications
        assertThat(refused.getMessage())
                .isEqualTo("The adopt order cannot reach devices [mac-2]: PACKAGE_ADOPT is switched off or their agent is too old for it");
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
        verifyNoInteractions(deviceService, softwareAdoptionRepository);
    }

    @Test
    void adopt_deviceNotManaged_refusedAndNothingSent() {
        // setup
        BadRequestException notManaged = new BadRequestException("Machine is not in a dispatchable state: mac-2");
        stubCaskAdoptableOnMacs();
        doThrow(notManaged).when(deviceService).verifyDispatchable(MACS);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(macsInput));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Machine is not in a dispatchable state: mac-2");
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
        verifyNoInteractions(softwareAdoptionRepository);
    }

    private void stubCaskAdoptableOnMacs() {
        when(softwareInventoryService.getAdoptionPackage(SOFTWARE_ID)).thenReturn(cask);
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(packageManagerAvailability.adoptableOn(MACS, PackageManagerType.BREW)).thenReturn(MACS);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, MACS)).thenReturn(Set.of(MAC, OTHER_MAC));
    }

    private static AdoptSoftwareInput input(List<String> machineIds) {
        AdoptSoftwareInput input = new AdoptSoftwareInput();
        input.setSoftwareId(SOFTWARE_ID);
        input.setMachineIds(machineIds);
        return input;
    }
}
