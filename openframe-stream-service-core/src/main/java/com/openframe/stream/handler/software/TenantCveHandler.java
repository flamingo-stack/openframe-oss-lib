package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.TenantCve;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.TenantCveRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.MessageHandler;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.time.Instant;

import static com.openframe.stream.handler.software.FleetRowFields.intOr;
import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.isGlobalStats;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class TenantCveHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final TenantCveRepository tenantCveRepository;

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

        if (delete) {
            tenantCveRepository.deleteByTenantIdAndCveId(tenantId, cveId);
            log.debug("[software-cdc] tenant_cve removed: tenant={} cve={}", tenantId, cveId);
            return;
        }

        TenantCve tenantCve = tenantCveRepository.findByTenantIdAndCveId(tenantId, cveId)
                .orElseGet(TenantCve::new);
        tenantCve.setTenantId(tenantId);
        tenantCve.setCveId(cveId);
        tenantCve.setDevicesCount(intOr(row, "host_count", 0));
        Instant now = Instant.now();
        if (tenantCve.getDiscoveredAt() == null) {
            tenantCve.setDiscoveredAt(now);
        }
        tenantCve.setUpdatedAt(now);
        tenantCveRepository.save(tenantCve);
        log.debug("[software-cdc] tenant_cve upserted: tenant={} cve={} devices={}",
                tenantId, cveId, tenantCve.getDevicesCount());
    }
}
