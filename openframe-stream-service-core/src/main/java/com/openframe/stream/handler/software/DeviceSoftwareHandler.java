package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
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

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@ConditionalOnProperty(name = "openframe.fleet.software-cdc.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class DeviceSoftwareHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetHostResolver fleetHostResolver;
    private final FleetHostSoftwareCache fleetHostSoftwareCache;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjector softwareProjector;
    private final VulnerabilityProjector vulnerabilityProjector;

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
        FleetHostRef host = fleetHostResolver.resolve(String.valueOf(hostId));
        if (host == null) {
            log.debug("[software-cdc] host_software for unresolved Fleet host {} — skipping", hostId);
            return;
        }
        reconcile(host, hostId);
    }

    private void reconcile(FleetHostRef host, Long hostId) {
        List<HostSoftwareTitle> titles = fleetHostSoftwareCache.hostSoftware(host.tenantId(), hostId);
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
            deviceSoftware.setTenantId(host.tenantId());
            deviceSoftware.setMachineId(host.machineId());
            deviceSoftware.setHostId(hostId);
            deviceSoftware.setSoftwareTitleId(titleId);
            deviceSoftware.setName(title.getName());
            deviceSoftware.setSource(title.getSource());
            deviceSoftware.setVersions(versionsOf(title));
            deviceSoftware.setVulnerabilities(vulnerabilities);
            deviceSoftware.setLastSeenAt(now);
            deviceSoftware.setUpdatedAt(now);
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

        affectedTitles.forEach(titleId -> softwareProjector.project(host.tenantId(), titleId));
        affectedCves.forEach(cve -> vulnerabilityProjector.project(host.tenantId(), cve));
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
