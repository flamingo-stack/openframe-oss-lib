package com.openframe.data.document.device;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DeviceStatusTest {

    @Test
    void values_lifecycleOnly_exactlyFive() {
        // execution
        DeviceStatus[] values = DeviceStatus.values();

        // verifications
        assertThat(values).containsExactly(
                DeviceStatus.PENDING, DeviceStatus.MANAGED, DeviceStatus.PENDING_DELETION,
                DeviceStatus.DELETED, DeviceStatus.ARCHIVED);
    }

    @Test
    void connected_managedOnly() {
        // verifications
        assertThat(DeviceStatus.CONNECTED).containsExactly(DeviceStatus.MANAGED);
    }

    @Test
    void frozen_lifecycleEndStates_includeArchived() {
        // verifications
        assertThat(DeviceStatus.FROZEN).containsExactlyInAnyOrder(
                DeviceStatus.PENDING_DELETION, DeviceStatus.DELETED, DeviceStatus.ARCHIVED);
    }

    @Test
    void isConnected_managed_true() {
        // execution
        boolean connected = DeviceStatus.MANAGED.isConnected();

        // verifications
        assertThat(connected).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = "MANAGED", mode = EnumSource.Mode.EXCLUDE)
    void isConnected_otherStatus_false(DeviceStatus status) {
        // execution
        boolean connected = status.isConnected();

        // verifications
        assertThat(connected).isFalse();
    }

    @ParameterizedTest
    @EnumSource(DeviceStatus.class)
    void fromStored_currentName_sameStatus(DeviceStatus status) {
        // setup
        String stored = status.name();

        // execution
        DeviceStatus read = DeviceStatus.fromStored(stored);

        // verifications
        assertThat(read).isEqualTo(status);
    }

    @ParameterizedTest
    @MethodSource("retiredNames")
    void fromStored_retiredName_mappedStatus(String stored, DeviceStatus expected) {
        // execution
        DeviceStatus read = DeviceStatus.fromStored(stored);

        // verifications
        assertThat(read).isEqualTo(expected);
    }

    @Test
    void fromStored_unknownName_throwsIllegalArgument() {
        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> DeviceStatus.fromStored("RETIRED"));

        // verifications
        assertThat(ex.getMessage()).contains("RETIRED");
    }

    @Test
    void fromStored_lowerCaseName_throwsIllegalArgument() {
        // execution
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> DeviceStatus.fromStored("online"));

        // verifications
        assertThat(ex.getMessage()).contains("online");
    }

    private static Stream<Arguments> retiredNames() {
        return Stream.of(
                Arguments.of("ONLINE", DeviceStatus.MANAGED),
                Arguments.of("OFFLINE", DeviceStatus.MANAGED),
                Arguments.of("ACTIVE", DeviceStatus.MANAGED),
                Arguments.of("INACTIVE", DeviceStatus.ARCHIVED),
                Arguments.of("MAINTENANCE", DeviceStatus.ARCHIVED),
                Arguments.of("DECOMMISSIONED", DeviceStatus.ARCHIVED));
    }
}
