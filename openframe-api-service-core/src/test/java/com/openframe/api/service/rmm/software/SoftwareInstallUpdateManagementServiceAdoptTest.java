package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.nats.delivery.PackageAdoptDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.nats.packageupdate.PackageReference;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import com.openframe.delivery.spec.DeliverySeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdateManagementServiceAdoptTest {

    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String WINDOWS = "win-1";
    private static final String CASK = "postman";
    private static final String WINDOWS_PACKAGE = "Google.Chrome";
    private static final List<String> MACS = List.of(MAC, OTHER_MAC);
    private static final Set<OsType> MAC_OS = Set.of(OsType.MAC_OS);
    private static final Set<OsType> WINDOWS_OS = Set.of(OsType.WINDOWS);
    private static final Map<String, OsType> MAC_OS_TYPES = Map.of(MAC, OsType.MAC_OS, OTHER_MAC, OsType.MAC_OS);

    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private DeviceService deviceService;
    @Mock private DeliveryRouter deliveryRouter;

    @Captor private ArgumentCaptor<PackageAdoptDeliverySeed> seedCaptor;

    @InjectMocks private SoftwareInstallUpdateManagementService service;

    private AdoptSoftwareInput brewInput;

    @BeforeEach
    void setUp() {
        brewInput = input(PackageManagerType.BREW, CASK, MACS);
    }

    @Test
    void adopt_brewOnMacs_caskOrderOfOneRequestSentToEachDevice() {
        // setup
        stubMacsReachable();
        PackageReference cask = PackageReference.builder()
                .manager(PackageManagerType.BREW)
                .kind(BrewPackageType.CASK)
                .name(CASK)
                .build();

        // execution
        List<String> ordered = service.adopt(brewInput);

        // verifications
        verify(deviceService).verifyDispatchable(MACS);
        verify(deliveryRouter, times(2)).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getType, PackageAdoptDeliverySeed::getMachineId,
                        PackageAdoptDeliverySeed::getPackageRef)
                .containsExactly(tuple(DeliveryType.PACKAGE_ADOPT, MAC, cask),
                        tuple(DeliveryType.PACKAGE_ADOPT, OTHER_MAC, cask));
        assertThat(seedCaptor.getAllValues())
                .extracting(PackageAdoptDeliverySeed::getRequestId)
                .doesNotContainNull()
                .containsOnly(seedCaptor.getValue().getRequestId());
        assertThat(ordered).containsExactly(MAC, OTHER_MAC);
    }

    @ParameterizedTest
    @MethodSource("windowsManagers")
    void adopt_windowsManager_orderCarriesThePackageIdToTheWindowsDevice(PackageManagerType packageManager) {
        // setup
        List<String> machineIds = List.of(WINDOWS);
        Map<String, OsType> osTypes = Map.of(WINDOWS, OsType.WINDOWS);
        AdoptSoftwareInput input = input(packageManager, WINDOWS_PACKAGE, machineIds);
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, WINDOWS_OS)).thenReturn(machineIds);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, machineIds)).thenReturn(Set.of(WINDOWS));
        PackageReference windowsPackage = PackageReference.builder()
                .manager(packageManager)
                .id(WINDOWS_PACKAGE)
                .build();

        // execution
        List<String> ordered = service.adopt(input);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue().getPackageRef()).isEqualTo(windowsPackage);
        assertThat(ordered).containsExactly(WINDOWS);
    }

    @Test
    void adopt_deviceOfAnotherOsAmongTheGiven_leftOutAndTheRestOrdered() {
        // setup
        List<String> machineIds = List.of(MAC, WINDOWS);
        List<String> macOnly = List.of(MAC);
        Map<String, OsType> osTypes = Map.of(MAC, OsType.MAC_OS, WINDOWS, OsType.WINDOWS);
        AdoptSoftwareInput input = input(PackageManagerType.BREW, CASK, machineIds);
        when(machinePlatformResolver.osTypesByMachineId(machineIds)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(machineIds, osTypes, MAC_OS)).thenReturn(macOnly);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, macOnly)).thenReturn(Set.of(MAC));

        // execution
        List<String> ordered = service.adopt(input);

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
        AdoptSoftwareInput input = input(PackageManagerType.BREW, CASK, List.of(MAC, MAC));
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
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
        AdoptSoftwareInput input = input(PackageManagerType.BREW, CASK, macOnly);
        when(machinePlatformResolver.osTypesByMachineId(macOnly)).thenReturn(osTypes);
        when(machinePlatformResolver.compatible(macOnly, osTypes, MAC_OS)).thenReturn(macOnly);
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
    void adopt_noDeviceOfTheManagersOs_refusedAndNothingSent() {
        // setup
        Map<String, OsType> noOsTypes = Map.of();
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(noOsTypes);
        when(machinePlatformResolver.compatible(MACS, noOsTypes, MAC_OS)).thenReturn(List.of());

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(brewInput));

        // verifications
        assertThat(refused.getMessage())
                .isEqualTo("None of the given devices can adopt with BREW: it takes a MAC_OS device with a usable package manager");
        verifyNoInteractions(deliveryRouter, deviceService);
    }

    @Test
    void adopt_orderDoesNotReachADevice_refusedAndNothingSent() {
        // setup
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, MACS)).thenReturn(Set.of(MAC));

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(brewInput));

        // verifications
        assertThat(refused.getMessage())
                .isEqualTo("The adopt order cannot reach devices [mac-2]: PACKAGE_ADOPT is switched off or their agent is too old for it");
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
        verifyNoInteractions(deviceService);
    }

    @Test
    void adopt_deviceNotManaged_refusedAndNothingSent() {
        // setup
        BadRequestException notManaged = new BadRequestException("Machine is not in a dispatchable state: mac-2");
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, MACS)).thenReturn(Set.of(MAC, OTHER_MAC));
        doThrow(notManaged).when(deviceService).verifyDispatchable(MACS);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(brewInput));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Machine is not in a dispatchable state: mac-2");
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void adopt_noPackageName_refusedBeforeAnyLookup(String packageName) {
        // setup
        AdoptSoftwareInput input = input(PackageManagerType.BREW, packageName, MACS);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(input));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("An adoption needs packageManager and packageName");
        verifyNoInteractions(machinePlatformResolver, deliveryRouter, deviceService);
    }

    @Test
    void adopt_noPackageManager_refusedBeforeAnyLookup() {
        // setup
        AdoptSoftwareInput input = input(null, CASK, MACS);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> service.adopt(input));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("An adoption needs packageManager and packageName");
        verifyNoInteractions(machinePlatformResolver, deliveryRouter, deviceService);
    }

    private void stubMacsReachable() {
        when(machinePlatformResolver.osTypesByMachineId(MACS)).thenReturn(MAC_OS_TYPES);
        when(machinePlatformResolver.compatible(MACS, MAC_OS_TYPES, MAC_OS)).thenReturn(MACS);
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_ADOPT, MACS)).thenReturn(Set.of(MAC, OTHER_MAC));
    }

    private static AdoptSoftwareInput input(PackageManagerType packageManager, String packageName,
                                            List<String> machineIds) {
        AdoptSoftwareInput input = new AdoptSoftwareInput();
        input.setPackageManager(packageManager);
        input.setPackageName(packageName);
        input.setMachineIds(machineIds);
        return input;
    }

    private static Stream<Arguments> windowsManagers() {
        return Stream.of(
                Arguments.of(PackageManagerType.WINGET),
                Arguments.of(PackageManagerType.CHOCO));
    }
}
