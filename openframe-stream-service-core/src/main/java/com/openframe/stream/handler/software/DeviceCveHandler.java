package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceOperatingSystem;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.document.rmm.software.FleetOsVulnerability;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOsVulnerabilityRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareCveRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceCveHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetHostResolver fleetHostResolver;
    private final FleetSoftwareCveRepository fleetSoftwareCveRepository;
    private final FleetSoftwareRepository fleetSoftwareRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final FleetOsVulnerabilityRepository fleetOsVulnerabilityRepository;
    private final FleetOperatingSystemRepository fleetOperatingSystemRepository;
    private final DeviceOperatingSystemRepository deviceOperatingSystemRepository;
    private final DeviceCveRepository deviceCveRepository;
    private final TenantSoftwareCveAggregator tenantSoftwareCveAggregator;

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
        MessageType type = message.getMessageType();
        if (payload == null || type == null) {
            return;
        }
        switch (type) {
            case FLEET_MDM_HOST_SOFTWARE_EVENT -> handleHostSoftware(payload);
            case FLEET_MDM_HOST_OPERATING_SYSTEM_EVENT -> handleHostOperatingSystem(payload);
            case FLEET_MDM_OS_VULNERABILITY_EVENT -> handleOsVulnerability(payload);
            case FLEET_MDM_SOFTWARE_CVE_EVENT -> handleSoftwareCve(payload);
            default -> { }
        }
    }

    private void handleHostSoftware(DebeziumMessage.Payload<JsonNode> payload) {
        boolean delete = isDelete(payload.getOperation());
        JsonNode row = delete ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long hostId = longOrNull(row, "host_id");
        Long softwareId = longOrNull(row, "software_id");
        if (hostId == null || softwareId == null) {
            return;
        }
        FleetHostRef host = fleetHostResolver.resolve(String.valueOf(hostId));
        if (host == null) {
            log.debug("[software-cdc] device_cve: unresolved Fleet host {} — skipping (software {})", hostId, softwareId);
            return;
        }
        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId).orElse(null);
        Long titleId = software == null ? null : software.getSoftwareTitleId();
        if (delete) {
            deviceCveRepository.deleteByTenantIdAndMachineIdAndSoftwareId(host.tenantId(), host.machineId(), softwareId);
            tenantSoftwareCveAggregator.recompute(host.tenantId(), titleId);
            return;
        }
        List<FleetSoftwareCve> cves = fleetSoftwareCveRepository.findBySoftwareId(softwareId);
        if (cves.isEmpty()) {
            // No CVE known for this software yet; a later software_cve event fans it in.
            return;
        }
        String version = software == null ? null : software.getVersion();
        for (FleetSoftwareCve sc : cves) {
            upsert(host.tenantId(), host.machineId(), hostId, sc.getCve(), softwareId, titleId, version,
                    sc.getResolvedInVersion());
        }
        tenantSoftwareCveAggregator.recompute(host.tenantId(), titleId);
    }

    private void handleSoftwareCve(DebeziumMessage.Payload<JsonNode> payload) {
        boolean delete = isDelete(payload.getOperation());
        JsonNode row = delete ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long softwareId = longOrNull(row, "software_id");
        String cve = str(row, "cve");
        if (softwareId == null || cve == null || cve.isBlank()) {
            return;
        }

        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId).orElse(null);
        Long softwareTitleId = software == null ? null : software.getSoftwareTitleId();
        String version = software == null ? null : software.getVersion();
        String resolvedInVersion = str(row, "resolved_in_version");

        if (delete) {
            fleetSoftwareCveRepository.deleteBySoftwareIdAndCve(softwareId, cve);
        } else {
            upsertCatalog(softwareId, cve, resolvedInVersion);
        }

        Set<String> affectedTenants = new HashSet<>();
        for (DeviceSoftware ds : deviceSoftwareRepository.findBySoftwareId(softwareId)) {
            if (delete) {
                deviceCveRepository.deleteByTenantIdAndMachineIdAndCveIdAndSoftwareId(
                        ds.getTenantId(), ds.getMachineId(), cve, softwareId);
            } else {
                upsert(ds.getTenantId(), ds.getMachineId(), ds.getHostId(), cve, softwareId,
                        softwareTitleId != null ? softwareTitleId : ds.getSoftwareTitleId(),
                        version != null ? version : ds.getVersion(),
                        resolvedInVersion);
            }
            affectedTenants.add(ds.getTenantId());
        }
        for (String tenant : affectedTenants) {
            tenantSoftwareCveAggregator.recompute(tenant, softwareTitleId);
        }
    }

    private void handleHostOperatingSystem(DebeziumMessage.Payload<JsonNode> payload) {
        boolean delete = isDelete(payload.getOperation());
        JsonNode row = delete ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long hostId = longOrNull(row, "host_id");
        Long osId = longOrNull(row, "os_id");
        if (hostId == null) {
            return;
        }
        FleetHostRef host = fleetHostResolver.resolve(String.valueOf(hostId));
        if (host == null) {
            log.debug("[software-cdc] device_cve(os): unresolved Fleet host {} — skipping (os {})", hostId, osId);
            return;
        }
        // One OS per device, and it can change — clear the device's OS CVE rows and re-derive.
        deviceCveRepository.deleteByTenantIdAndMachineIdAndSoftwareIdIsNull(host.tenantId(), host.machineId());
        if (delete || osId == null) {
            return;
        }
        List<FleetOsVulnerability> cves = fleetOsVulnerabilityRepository.findByOsId(osId);
        if (cves.isEmpty()) {
            return;
        }
        String version = osVersion(osId);
        for (FleetOsVulnerability ov : cves) {
            upsert(host.tenantId(), host.machineId(), hostId, ov.getCve(), null, null, version, ov.getResolvedInVersion());
        }
    }

    private void handleOsVulnerability(DebeziumMessage.Payload<JsonNode> payload) {
        boolean delete = isDelete(payload.getOperation());
        JsonNode row = delete ? payload.getBefore() : payload.getAfter();
        if (row == null) {
            return;
        }
        Long osId = longOrNull(row, "operating_system_id");
        String cve = str(row, "cve");
        if (osId == null || cve == null || cve.isBlank()) {
            return;
        }

        if (delete) {
            fleetOsVulnerabilityRepository.deleteByOsIdAndCve(osId, cve);
            for (DeviceOperatingSystem device : deviceOperatingSystemRepository.findByOsId(osId)) {
                deviceCveRepository.deleteByTenantIdAndMachineIdAndCveIdAndSoftwareId(
                        device.getTenantId(), device.getMachineId(), cve, null);
            }
            return;
        }

        String resolvedInVersion = str(row, "resolved_in_version");
        upsertOsCatalog(osId, cve, resolvedInVersion);

        String version = osVersion(osId);
        for (DeviceOperatingSystem device : deviceOperatingSystemRepository.findByOsId(osId)) {
            upsert(device.getTenantId(), device.getMachineId(), device.getHostId(), cve, null, null,
                    device.getVersion() != null ? device.getVersion() : version, resolvedInVersion);
        }
    }

    private String osVersion(Long osId) {
        return fleetOperatingSystemRepository.findByOsId(osId)
                .map(FleetOperatingSystem::getVersion)
                .orElse(null);
    }

    private void upsertOsCatalog(Long osId, String cve, String resolvedInVersion) {
        FleetOsVulnerability entry = fleetOsVulnerabilityRepository.findByOsIdAndCve(osId, cve)
                .orElseGet(FleetOsVulnerability::new);
        entry.setOsId(osId);
        entry.setCve(cve);
        entry.setResolvedInVersion(resolvedInVersion);
        entry.setUpdatedAt(Instant.now());
        fleetOsVulnerabilityRepository.save(entry);
    }

    private void upsertCatalog(Long softwareId, String cve, String resolvedInVersion) {
        FleetSoftwareCve entry = fleetSoftwareCveRepository.findBySoftwareIdAndCve(softwareId, cve)
                .orElseGet(FleetSoftwareCve::new);
        entry.setSoftwareId(softwareId);
        entry.setCve(cve);
        entry.setResolvedInVersion(resolvedInVersion);
        entry.setUpdatedAt(Instant.now());
        fleetSoftwareCveRepository.save(entry);
    }

    private void upsert(String tenantId, String machineId, Long hostId, String cve, Long softwareId,
                        Long softwareTitleId, String installedVersion, String resolvedInVersion) {
        if (tenantId == null || machineId == null) {
            return;
        }
        DeviceCve deviceCve = deviceCveRepository
                .findByTenantIdAndMachineIdAndCveIdAndSoftwareId(tenantId, machineId, cve, softwareId)
                .orElseGet(DeviceCve::new);
        boolean isNew = deviceCve.getId() == null;
        Instant now = Instant.now();
        deviceCve.setTenantId(tenantId);
        deviceCve.setMachineId(machineId);
        deviceCve.setHostId(hostId);
        deviceCve.setCveId(cve);
        deviceCve.setSoftwareId(softwareId);
        deviceCve.setSoftwareTitleId(softwareTitleId);
        deviceCve.setInstalledVersion(installedVersion);
        deviceCve.setResolvedInVersion(resolvedInVersion);
        if (isNew || deviceCve.getDiscoveredAt() == null) {
            deviceCve.setDiscoveredAt(now);
        }
        deviceCve.setUpdatedAt(now);
        deviceCveRepository.save(deviceCve);
    }
}
