package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceOperatingSystem;
import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
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

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOperatingSystemHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetHostResolver fleetHostResolver;
    private final FleetOperatingSystemRepository fleetOperatingSystemRepository;
    private final DeviceOperatingSystemRepository deviceOperatingSystemRepository;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_DEVICE_OS;
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
        Long osId = longOrNull(row, "os_id");
        if (hostId == null) {
            return;
        }
        FleetHostRef host = fleetHostResolver.resolve(String.valueOf(hostId));
        if (host == null) {
            log.debug("[software-cdc] device_operating_system: unresolved Fleet host {} — skipping", hostId);
            return;
        }

        if (delete) {
            deviceOperatingSystemRepository.deleteByTenantIdAndMachineId(host.tenantId(), host.machineId());
            log.debug("[software-cdc] device_operating_system removed: tenant={} machine={}",
                    host.tenantId(), host.machineId());
            return;
        }

        DeviceOperatingSystem deviceOs = deviceOperatingSystemRepository
                .findByTenantIdAndMachineId(host.tenantId(), host.machineId())
                .orElseGet(DeviceOperatingSystem::new);
        deviceOs.setTenantId(host.tenantId());
        deviceOs.setMachineId(host.machineId());
        deviceOs.setHostId(hostId);
        deviceOs.setOsId(osId);
        applyCatalog(deviceOs, osId);
        deviceOs.setUpdatedAt(Instant.now());
        deviceOperatingSystemRepository.save(deviceOs);
        log.debug("[software-cdc] device_operating_system upserted: tenant={} machine={} os={}",
                host.tenantId(), host.machineId(), osId);
    }

    private void applyCatalog(DeviceOperatingSystem deviceOs, Long osId) {
        if (osId == null) {
            return;
        }
        fleetOperatingSystemRepository.findByOsId(osId).ifPresent(os -> {
            deviceOs.setName(os.getName());
            deviceOs.setVersion(os.getVersion());
            deviceOs.setPlatform(os.getPlatform());
        });
    }
}
