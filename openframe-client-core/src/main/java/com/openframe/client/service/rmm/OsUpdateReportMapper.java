package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateCategory;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@Slf4j
public class OsUpdateReportMapper {

    private static final String ENTRY_KEY_SEPARATOR = "|";
    private static final Map<String, OsUpdateSeverity> SEVERITY_BY_NAME = Arrays.stream(OsUpdateSeverity.values())
            .collect(Collectors.toUnmodifiableMap(OsUpdateSeverity::name, Function.identity()));

    public List<DeviceOsUpdate> toPendingUpdates(String tenantId, String machineId,
                                                 List<MachineOsUpdatesMessage.PendingUpdate> reported,
                                                 Instant discoveredAt) {
        Map<String, DeviceOsUpdate> byUpdateKey = new LinkedHashMap<>();
        for (MachineOsUpdatesMessage.PendingUpdate update : reported) {
            pendingUpdateOf(tenantId, machineId, update, discoveredAt)
                    .ifPresent(pending -> byUpdateKey.put(pending.getUpdateKey(), pending));
        }
        return new ArrayList<>(byUpdateKey.values());
    }

    public List<DeviceOsUpdateHistoryEntry> toHistoryEntries(String tenantId, String machineId,
                                                             List<MachineOsUpdatesMessage.InstalledUpdate> reported) {
        if (reported == null) {
            return List.of();
        }
        Map<String, DeviceOsUpdateHistoryEntry> byEntryKey = new LinkedHashMap<>();
        for (MachineOsUpdatesMessage.InstalledUpdate installed : reported) {
            historyEntryOf(tenantId, machineId, installed)
                    .ifPresent(entry -> byEntryKey.put(entry.getEntryKey(), entry));
        }
        return new ArrayList<>(byEntryKey.values());
    }

    private static Optional<DeviceOsUpdate> pendingUpdateOf(String tenantId, String machineId,
                                                            MachineOsUpdatesMessage.PendingUpdate update,
                                                            Instant discoveredAt) {
        if (isIncomplete(update)) {
            log.warn("Skipping pending OS update without updateKey or title from machineId={}: {}", machineId, update);
            return Optional.empty();
        }
        return Optional.of(DeviceOsUpdate.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .updateKey(update.getUpdateKey())
                .title(update.getTitle())
                .version(update.getVersion())
                .kbArticleIds(withoutNulls(update.getKbArticleIds()))
                .severity(severityNamed(update.getMsrcSeverity()).orElse(null))
                .categories(categoriesOf(update.getCategories()))
                .browseOnly(update.getBrowseOnly())
                .publishedAt(update.getPublishedAt())
                .sizeBytes(update.getSizeBytes())
                .restartBehaviour(update.getRestartBehaviour())
                .discoveredAt(discoveredAt)
                .build());
    }

    private static Optional<DeviceOsUpdateHistoryEntry> historyEntryOf(String tenantId, String machineId,
                                                                       MachineOsUpdatesMessage.InstalledUpdate installed) {
        if (isIncomplete(installed)) {
            log.warn("Skipping OS update history entry without title or installedAt from machineId={}: {}",
                    machineId, installed);
            return Optional.empty();
        }
        return Optional.of(DeviceOsUpdateHistoryEntry.builder()
                .tenantId(tenantId)
                .machineId(machineId)
                .entryKey(entryKeyOf(installed))
                .updateKey(installed.getUpdateKey())
                .title(installed.getTitle())
                .version(installed.getVersion())
                .installedAt(installed.getInstalledAt())
                .operation(installed.getOperation())
                .result(installed.getResult())
                .errorCode(installed.getHresult())
                .build());
    }

    private static boolean isIncomplete(MachineOsUpdatesMessage.PendingUpdate update) {
        return update == null || isBlank(update.getUpdateKey()) || isBlank(update.getTitle());
    }

    private static boolean isIncomplete(MachineOsUpdatesMessage.InstalledUpdate installed) {
        return installed == null || isBlank(installed.getTitle()) || installed.getInstalledAt() == null;
    }

    private static Optional<OsUpdateSeverity> severityNamed(String msrcSeverity) {
        return Optional.ofNullable(msrcSeverity)
                .map(name -> name.toUpperCase(Locale.ROOT))
                .map(SEVERITY_BY_NAME::get);
    }

    private static List<String> withoutNulls(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream().filter(Objects::nonNull).toList();
    }

    private static List<DeviceOsUpdateCategory> categoriesOf(List<MachineOsUpdatesMessage.Category> categories) {
        if (categories == null) {
            return List.of();
        }
        return categories.stream()
                .filter(OsUpdateReportMapper::hasIdOrName)
                .map(OsUpdateReportMapper::toCategory)
                .toList();
    }

    private static boolean hasIdOrName(MachineOsUpdatesMessage.Category category) {
        return category != null && (isNotBlank(category.getId()) || isNotBlank(category.getName()));
    }

    private static DeviceOsUpdateCategory toCategory(MachineOsUpdatesMessage.Category category) {
        return DeviceOsUpdateCategory.builder()
                .id(defaultIfBlank(category.getId(), null))
                .name(defaultIfBlank(category.getName(), null))
                .build();
    }

    private static String entryKeyOf(MachineOsUpdatesMessage.InstalledUpdate installed) {
        String identity = isBlank(installed.getUpdateKey()) ? installed.getTitle() : installed.getUpdateKey();
        return identity + ENTRY_KEY_SEPARATOR + installed.getInstalledAt().toEpochMilli()
                + ENTRY_KEY_SEPARATOR + installed.getOperation();
    }
}
