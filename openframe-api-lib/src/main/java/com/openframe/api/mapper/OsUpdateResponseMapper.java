package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

import static java.util.Objects.requireNonNullElse;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsUpdateResponseMapper {

    public OsUpdateResponse toResponse(OsUpdate osUpdate, String cursor) {
        return OsUpdateResponse.builder()
                .id(osUpdate.getId())
                .platform(osUpdate.getPlatform())
                .identifier(osUpdate.getIdentifier())
                .displayName(osUpdate.getDisplayName())
                .displayVersion(osUpdate.getDisplayVersion())
                .kbArticleIds(requireNonNullElse(osUpdate.getKbArticleIds(), List.of()))
                .severity(osUpdate.getSeverity())
                .categories(requireNonNullElse(osUpdate.getCategories(), List.of()))
                .categoryIds(requireNonNullElse(osUpdate.getCategoryIds(), List.of()))
                .updateType(osUpdate.getUpdateType())
                .classification(osUpdate.getClassification())
                .cveIds(requireNonNullElse(osUpdate.getCveIds(), List.of()))
                .publishedAt(osUpdate.getPublishedAt())
                .sizeBytes(osUpdate.getSizeBytes())
                .rebootBehavior(osUpdate.getRebootBehavior())
                .browseOnly(osUpdate.getBrowseOnly())
                .exploited(osUpdate.getExploited())
                .enrichedAt(osUpdate.getEnrichedAt())
                .firstSeenAt(osUpdate.getFirstSeenAt())
                .cursor(cursor)
                .build();
    }

    public OsUpdateDeviceResponse toPendingDeviceResponse(DeviceOsPendingUpdate pendingUpdate, String cursor) {
        return OsUpdateDeviceResponse.builder()
                .machineId(pendingUpdate.getMachineId())
                .status(OsUpdateDeviceStatus.PENDING)
                .discoveredAt(pendingUpdate.getDiscoveredAt())
                .cursor(cursor)
                .build();
    }

    public OsUpdateDeviceResponse toInstalledDeviceResponse(InstalledOsUpdateDevice installedDevice, String cursor) {
        return OsUpdateDeviceResponse.builder()
                .machineId(installedDevice.getMachineId())
                .status(OsUpdateDeviceStatus.INSTALLED)
                .installedAt(installedDevice.getInstalledAt())
                .cursor(cursor)
                .build();
    }
}
