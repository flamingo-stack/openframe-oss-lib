package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.LastOsInstall;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class DeviceOsStateParser {

    private final ReportedEnumParser reportedEnumParser;

    public DeviceOsState parse(ReportingDevice reportingDevice, MachineOsUpdatesMessage message) {
        return DeviceOsState.builder()
                .tenantId(reportingDevice.getTenantId())
                .machineId(reportingDevice.getMachineId())
                .platform(reportingDevice.getPlatform())
                .osVersion(message.getOsVersion())
                .osBuild(message.getOsBuild())
                .osProductName(message.getOsProductName())
                .scanState(reportedEnumParser.parse(OsUpdateScanState.class, message.getScanState()))
                .lastScanAt(message.getLastScanAt())
                .pendingUpdatesConfidence(parsePendingUpdatesConfidence(message.getUpdates()))
                .patchState(reportedEnumParser.parse(OsPatchState.class, message.getPatchState()))
                .rebootPending(reportedEnumParser.parse(OsRebootPending.class, message.getRebootPending()))
                .manageability(parseManageability(message.getManageability()))
                .osUpdateAuthorization(
                        reportedEnumParser.parse(OsUpdateAuthorization.class, message.getOsUpdateAuthorization()))
                .lastOsInstall(parseLastOsInstall(message.getLastOsInstall()))
                .platformDetails(parsePlatformDetails(reportingDevice.getPlatform(), message))
                .reportedAt(message.getReportedAt())
                .receivedAt(reportingDevice.getReceivedAt())
                .build();
    }

    private OsUpdateListConfidence parsePendingUpdatesConfidence(MachineOsUpdatesMessage.UpdateSet updates) {
        if (updates == null) {
            return null;
        }
        return reportedEnumParser.parse(OsUpdateListConfidence.class, updates.getConfidence());
    }

    private OsUpdateManageability parseManageability(MachineOsUpdatesMessage.Manageability manageability) {
        if (manageability == null) {
            return null;
        }
        List<String> reasons = manageability.getReasons() != null ? manageability.getReasons() : List.of();
        return OsUpdateManageability.builder()
                .state(reportedEnumParser.parse(OsUpdateManageabilityState.class, manageability.getState()))
                .reasons(reasons)
                .build();
    }

    private static LastOsInstall parseLastOsInstall(MachineOsUpdatesMessage.LastOsInstall lastOsInstall) {
        if (lastOsInstall == null || lastOsInstall.getInstalledAt() == null) {
            return null;
        }
        return LastOsInstall.builder()
                .identifier(lastOsInstall.getIdentifier())
                .displayName(lastOsInstall.getDisplayName())
                .displayVersion(lastOsInstall.getDisplayVersion())
                .installedAt(lastOsInstall.getInstalledAt())
                .build();
    }

    // The block of the reporting platform, stored as it came. The other platform's block is never present.
    private static Map<String, Object> parsePlatformDetails(OsPlatform platform, MachineOsUpdatesMessage message) {
        if (platform == OsPlatform.MACOS) {
            return message.getMacos();
        }
        MachineOsUpdatesMessage.WindowsDetails windows = message.getWindows();
        return windows != null ? windows.getDetails() : null;
    }
}
