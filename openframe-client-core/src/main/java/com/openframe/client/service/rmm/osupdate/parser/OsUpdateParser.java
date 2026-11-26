package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage.WindowsUpdateCategory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.function.Function;

@Component
@RequiredArgsConstructor
public class OsUpdateParser {

    private final ReportedEnumParser reportedEnumParser;

    public List<OsUpdate> parse(ReportingDevice reportingDevice, List<MachineOsUpdatesMessage.UpdateItem> items) {
        return items.stream()
                .map(item -> parse(reportingDevice, item))
                .toList();
    }

    // Windows describes an update itself. A Mac sends a name and a version only: the rest stays empty.
    private OsUpdate parse(ReportingDevice reportingDevice, MachineOsUpdatesMessage.UpdateItem item) {
        OsUpdate.OsUpdateBuilder osUpdate = OsUpdate.builder()
                .tenantId(reportingDevice.getTenantId())
                .platform(reportingDevice.getPlatform())
                .identifier(item.getIdentifier())
                .displayName(item.getDisplayName())
                .displayVersion(item.getDisplayVersion())
                .firstSeenAt(reportingDevice.getReceivedAt());
        MachineOsUpdatesMessage.WindowsUpdate windows = item.getWindows();
        if (windows == null) {
            return osUpdate.build();
        }
        return osUpdate
                .kbArticleIds(orEmpty(windows.getKbArticleIds()))
                .severity(reportedEnumParser.parse(OsUpdateSeverity.class, windows.getMsrcSeverity()))
                .categories(parseCategoryValues(windows.getCategories(), WindowsUpdateCategory::getName))
                .categoryIds(parseCategoryValues(windows.getCategories(), WindowsUpdateCategory::getId))
                .updateType(reportedEnumParser.parse(OsUpdateType.class, windows.getUpdateType()))
                .cveIds(orEmpty(windows.getCveIds()))
                .publishedAt(windows.getPublishedAt())
                .sizeBytes(windows.getMaxDownloadBytes())
                .rebootBehavior(reportedEnumParser.parse(OsUpdateRebootBehavior.class, windows.getRebootBehavior()))
                .browseOnly(windows.getBrowseOnly())
                .build();
    }

    private static List<String> parseCategoryValues(List<WindowsUpdateCategory> categories,
                                                    Function<WindowsUpdateCategory, String> categoryValue) {
        if (categories == null) {
            return List.of();
        }
        return categories.stream()
                .filter(Objects::nonNull)
                .map(categoryValue)
                .filter(Objects::nonNull)
                .toList();
    }

    private static List<String> orEmpty(List<String> values) {
        return values != null ? values : List.of();
    }
}
