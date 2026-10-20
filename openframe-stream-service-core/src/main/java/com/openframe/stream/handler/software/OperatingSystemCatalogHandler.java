package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.Objects;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class OperatingSystemCatalogHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetOperatingSystemRepository fleetOperatingSystemRepository;
    private final SoftwareCascadeSyncService cascadeSyncService;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_OS_CATALOG;
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
        Long osId = longOrNull(row, "id");
        if (osId == null) {
            return;
        }

        if (delete) {
            fleetOperatingSystemRepository.deleteByOsId(osId);
            log.debug("[software-cdc] fleet_operating_system removed: {}", osId);
            return;
        }

        String name = str(row, "name");
        String version = str(row, "version");
        String platform = str(row, "platform");

        FleetOperatingSystem os = fleetOperatingSystemRepository.findByOsId(osId)
                .orElseGet(FleetOperatingSystem::new);
        boolean detailsChanged = !Objects.equals(os.getName(), name)
                || !Objects.equals(os.getVersion(), version)
                || !Objects.equals(os.getPlatform(), platform);

        os.setOsId(osId);
        os.setName(name);
        os.setVersion(version);
        os.setPlatform(platform);
        os.setUpdatedAt(Instant.now());
        fleetOperatingSystemRepository.save(os);

        if (detailsChanged) {
            // Fan-out to every device_operating_system row can be large → defer to the cascade sweep.
            cascadeSyncService.enqueueOsDetails(osId);
        }
    }
}
