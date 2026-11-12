package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static com.openframe.data.document.rmm.software.SoftwareAction.INSTALL;
import static com.openframe.data.document.rmm.software.SoftwareAction.UPDATE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateEligibilityServiceTest {

    @Mock private DeliveryRouter deliveryRouter;
    @Mock private MachineRepository machineRepository;

    @InjectMocks private PackageUpdateEligibilityService service;

    private static Machine machine(String id, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(id);
        m.setStatus(status);
        return m;
    }

    @Test
    void eligibleMachines_emptyInput_isEmpty_noLookups() {
        assertThat(service.eligibleMachines(UPDATE, List.of())).isEmpty();
        verifyNoInteractions(deliveryRouter, machineRepository);
    }

    // the order only upgrades what is installed: an install always runs the script
    @Test
    void install_isNeverEligible_noLookups() {
        assertThat(service.eligibleMachines(INSTALL, List.of("m1"))).isEmpty();
        assertThat(service.eligibleConnectedMachines(INSTALL, List.of("m1"))).isEmpty();
        assertThat(service.isEligible(INSTALL, machine("m1", DeviceStatus.ONLINE))).isFalse();
        verifyNoInteractions(deliveryRouter, machineRepository);
    }

    @Test
    void eligibleMachines_theOnesARouteReachesForPackageUpdate() {
        List<String> asked = List.of("m1", "m2", "m3");
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, asked)).thenReturn(Set.of("m1", "m3"));

        assertThat(service.eligibleMachines(UPDATE, asked)).containsExactlyInAnyOrder("m1", "m3");
        verifyNoInteractions(machineRepository);   // the device's status plays no part here
    }

    @Test
    void eligibleMachines_noRouteReachesAny_isEmpty() {
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, List.of("m1"))).thenReturn(Set.of());

        assertThat(service.eligibleMachines(UPDATE, List.of("m1"))).isEmpty();
    }

    @Test
    void eligibleConnectedMachines_skipsDevicesThatAreNoLongerConnected() {
        List<String> asked = List.of("on", "off", "archived", "deleted", "old");
        Set<String> reachable = Set.of("on", "off", "archived", "deleted");    // "old": below the floor
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, asked)).thenReturn(reachable);
        when(machineRepository.findByMachineIdIn(reachable)).thenReturn(List.of(
                machine("on", DeviceStatus.ONLINE),
                machine("off", DeviceStatus.OFFLINE),
                machine("archived", DeviceStatus.ARCHIVED),
                machine("deleted", DeviceStatus.DELETED)));

        assertThat(service.eligibleConnectedMachines(UPDATE, asked)).containsExactlyInAnyOrder("on", "off");
    }

    @Test
    void eligibleConnectedMachines_noRouteReachesAny_noMachineLookup() {
        when(deliveryRouter.reachable(DeliveryType.PACKAGE_UPDATE, List.of("m1"))).thenReturn(Set.of());

        assertThat(service.eligibleConnectedMachines(UPDATE, List.of("m1"))).isEmpty();
        verifyNoInteractions(machineRepository);
    }

    @Test
    void isEligible_asksTheRouteForThatOneMachine() {
        when(deliveryRouter.reaches(DeliveryType.PACKAGE_UPDATE, "m1")).thenReturn(true);
        when(deliveryRouter.reaches(DeliveryType.PACKAGE_UPDATE, "m2")).thenReturn(false);

        assertThat(service.isEligible(UPDATE, machine("m1", DeviceStatus.ONLINE))).isTrue();
        assertThat(service.isEligible(UPDATE, machine("m2", DeviceStatus.ONLINE))).isFalse();
        verifyNoInteractions(machineRepository);
    }
}
