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

    public static DeviceFilterInput statDevicesFilter() {
        return statusDevicesFilter(
                DeviceStatus.ONLINE,
                DeviceStatus.OFFLINE,
                DeviceStatus.ACTIVE,
                DeviceStatus.INACTIVE,
                DeviceStatus.MAINTENANCE);
    }

    public static DeviceFilterInput osAndStatusDevicesFilter(String os, DeviceStatus... statuses) {
        return DeviceFilterInput.builder()
                .osTypes(List.of(os))
                .statuses(List.of(statuses))
                .build();
    }

    public static DeviceFilterInput statusDevicesFilter(DeviceStatus... statuses) {
        return DeviceFilterInput.builder()
                .statuses(List.of(statuses))
                .build();
    }

    public static String getTacticalId(Machine device) {
        return device.getToolConnections().stream()
                .filter(tc -> "TACTICAL_RMM".equals(tc.getToolType()))
                .findFirst()
                .map(ToolConnection::getAgentToolId)
                .orElse(null);
    }

    public static String getFleetId(Machine device) {
        return device.getToolConnections().stream()
                .filter(tc -> "FLEET_MDM".equals(tc.getToolType()))
                .findFirst()
                .map(ToolConnection::getAgentToolId)
                .orElse(null);
    }

    public static String getMeshId(Machine device) {
        return device.getToolConnections().stream()
                .filter(tc -> "MESHCENTRAL".equals(tc.getToolType()))
                .findFirst()
                .map(ToolConnection::getAgentToolId)
                .orElse(null);
    }
}
