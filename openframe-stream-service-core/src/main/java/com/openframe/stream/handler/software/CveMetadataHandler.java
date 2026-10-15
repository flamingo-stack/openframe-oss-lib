package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

import static com.openframe.stream.handler.software.FleetRowFields.boolOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.doubleOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.instantOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.severityOf;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class CveMetadataHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private static final String SOURCE = "fleet_cve_meta";

    private final CveMetadataRepository cveMetadataRepository;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_CVE_METADATA;
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
        String cveId = str(row, "cve");
        if (cveId == null || cveId.isBlank()) {
            return;
        }

        if (delete) {
            cveMetadataRepository.findByCveId(cveId).ifPresent(cveMetadataRepository::delete);
            log.debug("[software-cdc] cve_metadata removed: {}", cveId);
            return;
        }

        CveMetadata metadata = cveMetadataRepository.findByCveId(cveId).orElseGet(CveMetadata::new);
        metadata.setCveId(cveId);
        metadata.setCvssScore(doubleOrNull(row, "cvss_score"));
        metadata.setEpssProbability(doubleOrNull(row, "epss_probability"));
        metadata.setCisaKnownExploit(boolOrNull(row, "cisa_known_exploit"));
        metadata.setPublishedAt(instantOrNull(row, "published"));
        metadata.setDescription(str(row, "description"));
        metadata.setSeverity(severityOf(metadata.getCvssScore()));
        metadata.setSource(SOURCE);
        metadata.setCachedAt(Instant.now());
        cveMetadataRepository.save(metadata);
        log.debug("[software-cdc] cve_metadata upserted: {} (cvss={})", cveId, metadata.getCvssScore());
    }
}
