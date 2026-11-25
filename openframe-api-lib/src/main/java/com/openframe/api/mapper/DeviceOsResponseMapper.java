package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class DeviceOsResponseMapper {

    public DeviceOsStateResponse toResponse(DeviceOsState deviceOsState) {
        return DeviceOsStateResponse.builder()
                .platform(deviceOsState.getPlatform())
                .osVersion(deviceOsState.getOsVersion())
                .osBuild(deviceOsState.getOsBuild())
                .osProductName(deviceOsState.getOsProductName())
                .scanState(deviceOsState.getScanState())
                .lastScanAt(deviceOsState.getLastScanAt())
                .pendingUpdatesConfidence(deviceOsState.getPendingUpdatesConfidence())
                .patchState(deviceOsState.getPatchState())
                .rebootPending(deviceOsState.getRebootPending())
                .rebootPendingSince(deviceOsState.getRebootPendingSince())
                .manageability(deviceOsState.getManageability())
                .osUpdateAuthorization(deviceOsState.getOsUpdateAuthorization())
                .lastOsInstall(deviceOsState.getLastOsInstall())
                .reportedAt(deviceOsState.getReportedAt())
                .receivedAt(deviceOsState.getReceivedAt())
                .build();
    }

    // The pending update says what waits on this device, the OS update says what it is.
    public DeviceOsPendingUpdateResponse toResponse(DeviceOsPendingUpdate pendingUpdate, OsUpdate osUpdate) {
        return DeviceOsPendingUpdateResponse.builder()
                .identifier(pendingUpdate.getIdentifier())
                .discoveredAt(pendingUpdate.getDiscoveredAt())
                .downloaded(pendingUpdate.getDownloaded())
                .macosPresence(pendingUpdate.getMacosPresence())
                .displayName(osUpdate.getDisplayName())
                .displayVersion(osUpdate.getDisplayVersion())
                .kbArticleIds(orEmpty(osUpdate.getKbArticleIds()))
                .severity(osUpdate.getSeverity())
                .categories(orEmpty(osUpdate.getCategories()))
                .categoryIds(orEmpty(osUpdate.getCategoryIds()))
                .updateType(osUpdate.getUpdateType())
                .classification(osUpdate.getClassification())
                .cveIds(orEmpty(osUpdate.getCveIds()))
                .publishedAt(osUpdate.getPublishedAt())
                .sizeBytes(osUpdate.getSizeBytes())
                .rebootBehavior(osUpdate.getRebootBehavior())
                .browseOnly(osUpdate.getBrowseOnly())
                .build();
    }

    public DeviceOsUpdateHistoryEntryResponse toResponse(DeviceOsUpdateHistoryEntry historyEntry, String cursor) {
        return DeviceOsUpdateHistoryEntryResponse.builder()
                .identifier(historyEntry.getIdentifier())
                .title(historyEntry.getTitle())
                .installedAt(historyEntry.getInstalledAt())
                .operation(historyEntry.getOperation())
                .result(historyEntry.getResult())
                .errorCode(historyEntry.getErrorCode())
                .cursor(cursor)
                .build();
    }

    private static List<String> orEmpty(List<String> values) {
        return values != null ? values : List.of();
    }
}
