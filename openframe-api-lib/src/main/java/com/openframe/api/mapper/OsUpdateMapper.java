package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateCategory;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsUpdateMapper {

    public DeviceOsUpdateResponse toResponse(DeviceOsUpdate update) {
        return DeviceOsUpdateResponse.builder()
                .updateKey(update.getUpdateKey())
                .title(update.getTitle())
                .version(update.getVersion())
                .kbArticleIds(Objects.requireNonNullElse(update.getKbArticleIds(), List.of()))
                .severity(update.getSeverity())
                .categories(categoryNames(update.getCategories()))
                .browseOnly(update.getBrowseOnly())
                .publishedAt(update.getPublishedAt())
                .sizeBytes(update.getSizeBytes())
                .restartBehaviour(update.getRestartBehaviour())
                .discoveredAt(update.getDiscoveredAt())
                .build();
    }

    private static List<String> categoryNames(List<DeviceOsUpdateCategory> categories) {
        if (categories == null) {
            return List.of();
        }
        return categories.stream()
                .filter(Objects::nonNull)
                .map(DeviceOsUpdateCategory::getName)
                .filter(Objects::nonNull)
                .toList();
    }

    public DeviceOsUpdateHistoryEntryResponse toResponse(DeviceOsUpdateHistoryEntry entry, String cursor) {
        return DeviceOsUpdateHistoryEntryResponse.builder()
                .updateKey(entry.getUpdateKey())
                .title(entry.getTitle())
                .version(entry.getVersion())
                .installedAt(entry.getInstalledAt())
                .operation(entry.getOperation())
                .result(entry.getResult())
                .errorCode(entry.getErrorCode())
                .cursor(cursor)
                .build();
    }
}
