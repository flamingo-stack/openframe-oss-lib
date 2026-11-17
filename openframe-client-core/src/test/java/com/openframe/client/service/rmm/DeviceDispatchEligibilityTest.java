package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Arrays;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceDispatchEligibilityTest {

    @Test
    void isDispatchable_nullMachine_false() {
        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(null);

        // verifications
        assertThat(result).isFalse();
    }

    @ParameterizedTest(name = "status={0}, telemetry={1} -> {2}")
    @MethodSource("statusTelemetryMatrix")
    void isDispatchable_statusAndTelemetry_trueOnlyWhenConnectedAndOnline(
            DeviceStatus status, TelemetryStatus telemetry, boolean expected) {
        // setup
        Machine machine = machine(status, telemetry);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isEqualTo(expected);
    }

    @Test
    void isDispatchable_pendingAndOnline_false() {
        // setup
        Machine machine = machine(DeviceStatus.PENDING, TelemetryStatus.ONLINE);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isDispatchable_onlineAndOnline_true() {
        // setup
        Machine machine = machine(DeviceStatus.ONLINE, TelemetryStatus.ONLINE);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isDispatchable_offlineStatusButTelemetryOnline_true() {
        // setup
        Machine machine = machine(DeviceStatus.OFFLINE, TelemetryStatus.ONLINE);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isTrue();
    }

    @Test
    void isDispatchable_connectedButNullTelemetry_false() {
        // setup
        Machine machine = machine(DeviceStatus.ONLINE, null);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    @Test
    void isDispatchable_nullStatusAndOnline_false() {
        // setup
        Machine machine = machine(null, TelemetryStatus.ONLINE);

        // execution
        boolean result = DeviceDispatchEligibility.isDispatchable(machine);

        // verifications
        assertThat(result).isFalse();
    }

    private static Stream<Arguments> statusTelemetryMatrix() {
        TelemetryStatus[] telemetries = {TelemetryStatus.ONLINE, TelemetryStatus.OFFLINE, null};
        return Arrays.stream(DeviceStatus.values())
                .flatMap(status -> Arrays.stream(telemetries)
                        .map(telemetry -> Arguments.of(status, telemetry,
                                isManaged(status) && telemetry == TelemetryStatus.ONLINE)));
    }

    // independent oracle: MANAGED, plus ONLINE/OFFLINE until migration 031 rewrites them
    private static boolean isManaged(DeviceStatus status) {
        return status == DeviceStatus.MANAGED || status == DeviceStatus.ONLINE || status == DeviceStatus.OFFLINE;
    }

    private static Machine machine(DeviceStatus status, TelemetryStatus telemetry) {
        Machine machine = new Machine();
        machine.setStatus(status);
        machine.setTelemetryStatus(telemetry);
        return machine;
    }
}
