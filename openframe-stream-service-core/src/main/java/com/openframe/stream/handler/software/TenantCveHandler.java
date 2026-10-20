package com.openframe.stream.handler.software;

import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.isGlobalStats;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class TenantCveHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final VulnerabilityProjector vulnerabilityProjector;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_TENANT_CVE;
    }

    @Override
    public void handle(DeserializedDebeziumMessage message, IntegratedToolEnrichedData extraParams) {
        DebeziumMessage.Payload<JsonNode> payload = message.getPayload();
        if (payload == null) {
            return;
        }
        boolean delete = isDelete(payload.getOperation());
        JsonNode row = delete ? payload.getBefore() : payload.getAfter();
        if (row == null || isGlobalStats(row)) {
            return;
        }
        String tenantId = extraParams.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("[software-cdc] vulnerability_host_counts without resolved tenant — dropping (team_id={})",
                    str(row, "team_id"));
            return;
        }
        String cveId = str(row, "cve");
        if (cveId == null || cveId.isBlank()) {
            return;
        }
        vulnerabilityProjector.project(tenantId, cveId);
    }
}
