package com.openframe.stream.handler.software;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineFleetMembershipTest {

    private static final FleetHostRef HOST = new FleetHostRef("t1", "m1");

    @Mock private MachineRepository machineRepository;

    private MachineFleetMembership membership;

    @BeforeEach
    void setUp() {
        membership = new MachineFleetMembership(machineRepository);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING", "MANAGED"})
    void inFleet_deviceOutsideTheFrozenStatuses_isInTheFleet(DeviceStatus status) {
        // setup
        stubMachineIn(status);

        // execution
        boolean inFleet = membership.isInFleet(HOST);

        // verifications
        assertThat(inFleet).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"PENDING_DELETION", "DELETED", "ARCHIVED"})
    void inFleet_deviceInAFrozenStatus_isNotInTheFleet(DeviceStatus status) {
        // setup
        stubMachineIn(status);

        // execution
        boolean inFleet = membership.isInFleet(HOST);

        // verifications
        assertThat(inFleet).isFalse();
    }

    @Test
    void inFleet_machineThatDoesNotExist_isNotInTheFleet() {
        // setup
        when(machineRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.empty());

        // execution
        boolean inFleet = membership.isInFleet(HOST);

        // verifications
        assertThat(inFleet).isFalse();
    }

    @Test
    void inFleet_machineWithoutAStatus_isNotInTheFleet() {
        // setup
        stubMachineIn(null);

        // execution
        boolean inFleet = membership.isInFleet(HOST);

        // verifications
        assertThat(inFleet).isFalse();
    }

    @Test
    void inFleet_sameMachineAgainWithinTheWindow_readsTheMachineOnce() {
        // setup
        stubMachineIn(DeviceStatus.MANAGED);

        // execution
        membership.isInFleet(HOST);
        boolean again = membership.isInFleet(HOST);

        // verifications
        assertThat(again).isTrue();
        verify(machineRepository, times(1)).findByTenantIdAndMachineId("t1", "m1");
    }

    @Test
    void inFleet_machineThatDoesNotExist_isReadOnceWithinTheWindow() {
        // setup
        when(machineRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.empty());

        // execution
        membership.isInFleet(HOST);
        membership.isInFleet(HOST);

        // verifications
        verify(machineRepository, times(1)).findByTenantIdAndMachineId("t1", "m1");
    }

    private void stubMachineIn(DeviceStatus status) {
        Machine machine = new Machine();
        machine.setTenantId("t1");
        machine.setMachineId("m1");
        machine.setStatus(status);
        when(machineRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.of(machine));
    }
}
