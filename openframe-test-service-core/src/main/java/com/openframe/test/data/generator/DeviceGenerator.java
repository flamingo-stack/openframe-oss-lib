package com.openframe.test.data.generator;

import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.device.ToolConnection;

import java.util.List;

public class DeviceGenerator {

    public static DeviceFilterInput onlineDevicesFilter() {
        return statusDevicesFilter(DeviceStatus.ONLINE);
    }

    public static DeviceFilterInput offlineDevicesFilter() {
        return statusDevicesFilter(DeviceStatus.OFFLINE);
    }

    public static DeviceFilterInput osDevicesFilter(String os) {
        return DeviceFilterInput.builder()
                .osTypes(List.of(os))
                .build();
    }

    public static DeviceFilterInput listedStatusesDevicesFilter() {
        return statusDevicesFilter(
                DeviceStatus.ONLINE,
                DeviceStatus.OFFLINE,
                DeviceStatus.ACTIVE,
                DeviceStatus.INACTIVE,
                DeviceStatus.MAINTENANCE,
                DeviceStatus.DECOMMISSIONED,
                DeviceStatus.PENDING);
    }

    public static DeviceFilterInput statusDevicesFilter(DeviceStatus... statuses) {
        return DeviceFilterInput.builder()
                .statuses(List.of(statuses))
                .build();
    }

    public static String getFleetId(Machine device) {
        return device.getToolConnections().stream()
                .filter(tc -> "FLEET_MDM".equals(tc.getToolType()))
                .findFirst()
                .map(ToolConnection::getAgentToolId)
                .orElse(null);
    }
}
