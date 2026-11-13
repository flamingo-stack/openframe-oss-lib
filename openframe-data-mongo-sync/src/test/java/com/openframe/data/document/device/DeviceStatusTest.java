package com.openframe.data.document.device;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceStatusTest {

    @Test
    void connected_phaseTwo_managedPlusTheLegacyOnlineOffline() {
        assertThat(DeviceStatus.CONNECTED).containsExactlyInAnyOrder(
                DeviceStatus.MANAGED, DeviceStatus.ONLINE, DeviceStatus.OFFLINE);
    }

    @Test
    void frozen_lifecycleEndStates_includeArchived() {
        assertThat(DeviceStatus.FROZEN).containsExactlyInAnyOrder(
                DeviceStatus.PENDING_DELETION, DeviceStatus.DELETED, DeviceStatus.ARCHIVED);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"MANAGED", "ONLINE", "OFFLINE"})
    void isConnected_managedDevice_true(DeviceStatus status) {
        assertThat(status.isConnected()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = {"MANAGED", "ONLINE", "OFFLINE"}, mode = EnumSource.Mode.EXCLUDE)
    void isConnected_otherStatus_false(DeviceStatus status) {
        assertThat(status.isConnected()).isFalse();
    }
}
