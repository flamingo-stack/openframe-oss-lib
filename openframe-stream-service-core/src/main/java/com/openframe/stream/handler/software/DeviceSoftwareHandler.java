package com.openframe.stream.handler.software;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.service.rmm.software.SoftwareProjectionTrigger;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.isSnapshotRead;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@ConditionalOnProperty(name = "openframe.fleet.software-cdc.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DeviceSoftwareHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    static final Duration SNAPSHOT_HOST_WINDOW = Duration.ofHours(24);
    static final Duration SNAPSHOT_UNRESOLVED_HOST_WINDOW = Duration.ofMinutes(5);

    private final FleetHostResolver fleetHostResolver;
    private final FleetHostSoftwareCache fleetHostSoftwareCache;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjectionTrigger projectionTrigger;

    private final Cache<Long, Boolean> snapshotReconciledHosts = Caffeine.newBuilder()
            .expireAfterWrite(SNAPSHOT_HOST_WINDOW)
            .build();
    private final Cache<Long, Boolean> snapshotUnresolvedHosts = Caffeine.newBuilder()
            .expireAfterWrite(SNAPSHOT_UNRESOLVED_HOST_WINDOW)
            .build();

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_DEVICE_SOFTWARE;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        DebeziumMessage.Payload<JsonNode> payload = message.getPayload();
        if (payload == null) {
            return;
        }
        JsonNode row = isDelete(payload.getOperation()) ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long hostId = longOrNull(row, "host_id");
        if (hostId == null) {
            return;
        }
        boolean snapshotRead = isSnapshotRead(payload.getOperation());
        if (snapshotRead && (snapshotReconciledHosts.getIfPresent(hostId) != null
                || snapshotUnresolvedHosts.getIfPresent(hostId) != null)) {
            return;
        }
        String fleetHostId = String.valueOf(hostId);
        if (!fleetHostResolver.isResolvable(fleetHostId)) {
            if (snapshotRead) {
                snapshotUnresolvedHosts.put(hostId, Boolean.TRUE);
            }
            log.debug("[software-cdc] host_software for unresolved Fleet host {} — skipping", hostId);
            return;
        }
        FleetHostRef host = fleetHostResolver.resolve(fleetHostId);
        long commitTs = commitTimestamp(payload);
        reconcile(host, hostId, commitTs);
        if (snapshotRead) {
            snapshotReconciledHosts.put(hostId, Boolean.TRUE);
        }
    }

    // the source commit time: every row event of one Fleet commit shares it, so a burst re-reads Fleet once,
    // and a later commit on the same host never gets the list fetched for an earlier one
    private static long commitTimestamp(DebeziumMessage.Payload<JsonNode> payload) {
        DebeziumMessage.Payload.Source source = payload.getSource();
        if (source != null && source.getTimestamp() != null) {
            return source.getTimestamp();
        }
        Long emitted = payload.getTimestamp();
        return emitted == null ? 0L : emitted;
    }

    private void reconcile(FleetHostRef host, Long hostId, long commitTs) {
        List<HostSoftwareTitle> titles = fleetHostSoftwareCache.hostSoftware(host.tenantId(), hostId, commitTs);
        Instant now = Instant.now();
        Set<Long> present = new HashSet<>();
        Set<Long> affectedTitles = new HashSet<>();
        Set<String> affectedCves = new HashSet<>();

        List<DeviceSoftware> existingRows = deviceSoftwareRepository
                .findByTenantIdAndMachineId(host.tenantId(), host.machineId());
        for (DeviceSoftware existing : existingRows) {
            if (existing.getVulnerabilities() != null) {
                affectedCves.addAll(existing.getVulnerabilities());
            }
        }

        for (HostSoftwareTitle title : titles) {
            Long titleId = title.getId();
            if (titleId == null) {
                continue;
            }
            present.add(titleId);
            List<String> vulnerabilities = vulnerabilitiesOf(title);
            DeviceSoftware deviceSoftware = deviceSoftwareRepository
                    .findByTenantIdAndMachineIdAndSoftwareTitleId(host.tenantId(), host.machineId(), titleId)
                    .orElseGet(DeviceSoftware::new);
            boolean newRow = deviceSoftware.getId() == null;
            deviceSoftware.setTenantId(host.tenantId());
            deviceSoftware.setMachineId(host.machineId());
            deviceSoftware.setSoftwareTitleId(titleId);
            deviceSoftware.setName(title.getName());
            deviceSoftware.setSource(title.getSource());
            deviceSoftware.setVersions(versionsOf(title));
            deviceSoftware.setUpgradeCode(title.getUpgradeCode());
            deviceSoftware.setVendor(firstOf(title, HostSoftwareInstalledVersion::getVendor));
            deviceSoftware.setArpKeys(valuesOf(title, HostSoftwareInstalledVersion::getArpKey));
            deviceSoftware.setPackageFamilyNames(valuesOf(title, HostSoftwareInstalledVersion::getPackageFamilyName));
            deviceSoftware.setInstallerTypes(valuesOf(title, HostSoftwareInstalledVersion::getInstallerType));
            deviceSoftware.setSystemComponent(systemComponentOf(title));
            deviceSoftware.setWingetId(firstOf(title, HostSoftwareInstalledVersion::getWingetId));
            deviceSoftware.setVulnerabilities(vulnerabilities);
            deviceSoftware.setUpdatedAt(now);
            if (newRow) {
                deviceSoftware.setMachineConnected(true);
            }
            deviceSoftwareRepository.save(deviceSoftware);
            affectedTitles.add(titleId);
            affectedCves.addAll(vulnerabilities);
        }

        for (DeviceSoftware existing : existingRows) {
            if (!present.contains(existing.getSoftwareTitleId())) {
                deviceSoftwareRepository.delete(existing);
                affectedTitles.add(existing.getSoftwareTitleId());
            }
        }

        projectionTrigger.titlesChanged(host.tenantId(), affectedTitles);
        projectionTrigger.cvesChanged(host.tenantId(), affectedCves);
    }

    private static List<String> versionsOf(HostSoftwareTitle title) {
        if (title.getInstalledVersions() == null) {
            return List.of();
        }
        return title.getInstalledVersions().stream()
                .map(HostSoftwareInstalledVersion::getVersion)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private static String firstOf(HostSoftwareTitle title, Function<HostSoftwareInstalledVersion, String> value) {
        return installedVersionsOf(title).stream().map(value).filter(v -> !isBlank(v)).findFirst().orElse(null);
    }

    private static List<String> valuesOf(HostSoftwareTitle title, Function<HostSoftwareInstalledVersion, String> value) {
        return installedVersionsOf(title).stream().map(value).filter(v -> !isBlank(v)).distinct().toList();
    }

    // null until a version reports the flag; true only when every reporting version has it set
    private static Boolean systemComponentOf(HostSoftwareTitle title) {
        List<Boolean> flags = installedVersionsOf(title).stream()
                .map(HostSoftwareInstalledVersion::getSystemComponent).filter(Objects::nonNull).toList();
        return flags.isEmpty() ? null : flags.stream().allMatch(Boolean::booleanValue);
    }

    private static List<HostSoftwareInstalledVersion> installedVersionsOf(HostSoftwareTitle title) {
        return title.getInstalledVersions() == null ? List.of() : title.getInstalledVersions();
    }

    private static List<String> vulnerabilitiesOf(HostSoftwareTitle title) {
        if (title.getInstalledVersions() == null) {
            return List.of();
        }
        return title.getInstalledVersions().stream()
                .map(HostSoftwareInstalledVersion::getVulnerabilities)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .filter(cve -> !isBlank(cve))
                .distinct()
                .toList();
    }
}
