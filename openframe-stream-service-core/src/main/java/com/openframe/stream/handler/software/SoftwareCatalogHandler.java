package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
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
public class SoftwareCatalogHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetSoftwareRepository fleetSoftwareRepository;
    private final SoftwareCascadeSyncService cascadeSyncService;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_SOFTWARE_CATALOG;
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
        Long softwareId = longOrNull(row, "id");
        if (softwareId == null) {
            return;
        }

        if (delete) {
            fleetSoftwareRepository.deleteBySoftwareId(softwareId);
            log.debug("[software-cdc] fleet_software removed: {}", softwareId);
            return;
        }

        String name = str(row, "name");
        String version = str(row, "version");
        String source = str(row, "source");
        Long softwareTitleId = longOrNull(row, "title_id");

        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId)
                .orElseGet(FleetSoftware::new);
        boolean detailsChanged = !Objects.equals(software.getName(), name)
                || !Objects.equals(software.getVersion(), version)
                || !Objects.equals(software.getSource(), source)
                || !Objects.equals(software.getSoftwareTitleId(), softwareTitleId);

        software.setSoftwareId(softwareId);
        software.setSoftwareTitleId(softwareTitleId);
        software.setName(name);
        software.setVersion(version);
        software.setSource(source);
        software.setUpdatedAt(Instant.now());
        fleetSoftwareRepository.save(software);

        if (detailsChanged) {
            // Fan-out to every device_software row can be large → defer to the cascade sweep.
            cascadeSyncService.enqueueSoftwareDetails(softwareId);
        }
    }
}
