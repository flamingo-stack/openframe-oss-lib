package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
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

import static com.openframe.stream.handler.software.FleetRowFields.instantOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceSoftwareHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetHostResolver fleetHostResolver;
    private final FleetSoftwareRepository fleetSoftwareRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjector softwareProjector;

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
            log.debug("[software-cdc] host_software for unresolved Fleet host {} — skipping (software {})",
                    hostId, softwareId);
            return;
        }

        if (delete) {
            Long titleId = deviceSoftwareRepository
                    .findByTenantIdAndMachineIdAndSoftwareId(host.tenantId(), host.machineId(), softwareId)
                    .map(DeviceSoftware::getSoftwareTitleId).orElse(null);
            deviceSoftwareRepository.deleteByTenantIdAndMachineIdAndSoftwareId(
                    host.tenantId(), host.machineId(), softwareId);
            softwareProjector.project(host.tenantId(), titleId);
            return;
        }

        DeviceSoftware deviceSoftware = deviceSoftwareRepository
                .findByTenantIdAndMachineIdAndSoftwareId(host.tenantId(), host.machineId(), softwareId)
                .orElseGet(DeviceSoftware::new);
        deviceSoftware.setTenantId(host.tenantId());
        deviceSoftware.setMachineId(host.machineId());
        deviceSoftware.setHostId(hostId);
        deviceSoftware.setSoftwareId(softwareId);
        deviceSoftware.setLastSeenAt(instantOrNull(row, "last_opened_at"));
        applyCatalog(deviceSoftware, softwareId);
        deviceSoftware.setUpdatedAt(Instant.now());
        deviceSoftwareRepository.save(deviceSoftware);
        softwareProjector.project(host.tenantId(), deviceSoftware.getSoftwareTitleId());
    }

    private void applyCatalog(DeviceSoftware deviceSoftware, Long softwareId) {
        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId).orElse(null);
        if (software == null) {
            return;
        }
        deviceSoftware.setSoftwareTitleId(software.getSoftwareTitleId());
        deviceSoftware.setName(software.getName());
        deviceSoftware.setVersion(software.getVersion());
        deviceSoftware.setSource(software.getSource());
    }
}
