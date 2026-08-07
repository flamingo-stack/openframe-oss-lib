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

    public static DeviceFilterInput archivedDevicesFilter() {
        return statusDevicesFilter(DeviceStatus.ARCHIVED);
    }

    /**
     * Narrows a filter to one organization, in place.
     *
     * <p>Load-bearing for any case that <em>mutates</em> what it finds. A status-only filter spans the
     * whole tenant, which is harmless on a single-device fixture tenant and destructive on a shared one:
     * the archive cases picked an unrelated OFFLINE device out of a long-lived QA tenant, archived and
     * deleted it, and left the pipeline's own device assigned to the org it was about to archive — which
     * then failed with a 409.
     */
    public static DeviceFilterInput inOrganization(DeviceFilterInput filter, String organizationId) {
        filter.setOrganizationIds(List.of(organizationId));
        return filter;
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

    /**
     * Devices carrying {@code key:value}, e.g. {@code purpose:auto_test}. The API filters on key and
     * value as separate lists rather than a single "key:value" string, which is only how the UI renders
     * the chip.
     */
    public static DeviceFilterInput tagDevicesFilter(String key, String value) {
        return DeviceFilterInput.builder()
                .tagKeys(List.of(key))
                .tagValues(List.of(value))
                .build();
    }

    public static DeviceFilterInput statusDevicesFilter(DeviceStatus... statuses) {
        return DeviceFilterInput.builder()
                .statuses(List.of(statuses))
                .build();
    }

    public static DeviceFilterInput orgAndStatusDevicesFilter(String organizationId, DeviceStatus... statuses) {
        return DeviceFilterInput.builder()
                .organizationIds(List.of(organizationId))
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

    public static String getMeshId(Machine device) {
        return device.getToolConnections().stream()
                .filter(tc -> "MESHCENTRAL".equals(tc.getToolType()))
                .findFirst()
                .map(ToolConnection::getAgentToolId)
                .orElse(null);
    }
}
