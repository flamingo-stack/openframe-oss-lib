package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceCveHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetHostResolver fleetHostResolver;
    private final FleetHostSoftwareCache fleetHostSoftwareCache;
    private final DeviceCveRepository deviceCveRepository;
    private final DeviceCveWriter deviceCveWriter;
    private final SoftwareProjector softwareProjector;
    private final VulnerabilityProjector vulnerabilityProjector;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_DEVICE_CVE;
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
            log.debug("[software-cdc] host_software (cve) for unresolved Fleet host {} — skipping", hostId);
            return;
        }
        reconcile(host, hostId);
    }

    private void reconcile(FleetHostRef host, Long hostId) {
        List<HostSoftwareTitle> titles = fleetHostSoftwareCache.hostSoftware(host.tenantId(), hostId);
        Set<String> presentKeys = new HashSet<>();
        Set<String> affectedCves = new HashSet<>();
        Set<Long> affectedTitles = new HashSet<>();

        for (HostSoftwareTitle title : titles) {
            Long titleId = title.getId();
            if (titleId == null || title.getInstalledVersions() == null) {
                continue;
            }
            for (HostSoftwareInstalledVersion version : title.getInstalledVersions()) {
                if (version.getVulnerabilities() == null) {
                    continue;
                }
                for (String cve : version.getVulnerabilities()) {
                    if (isBlank(cve)) {
                        continue;
                    }
                    deviceCveWriter.upsert(host.tenantId(), host.machineId(), hostId, cve,
                            titleId, title.getName(), version.getVersion());
                    presentKeys.add(key(cve, titleId));
                    affectedCves.add(cve);
                    affectedTitles.add(titleId);
                }
            }
        }

        for (DeviceCve existing : deviceCveRepository.findByTenantIdAndMachineId(host.tenantId(), host.machineId())) {
            if (!presentKeys.contains(key(existing.getCveId(), existing.getSoftwareTitleId()))) {
                deviceCveRepository.delete(existing);
                affectedCves.add(existing.getCveId());
                if (existing.getSoftwareTitleId() != null) {
                    affectedTitles.add(existing.getSoftwareTitleId());
                }
            }
        }

        affectedTitles.forEach(titleId -> softwareProjector.project(host.tenantId(), titleId));
        affectedCves.forEach(cve -> vulnerabilityProjector.project(host.tenantId(), cve));
    }

    private static String key(String cve, Long titleId) {
        return cve + "|" + titleId;
    }
}
