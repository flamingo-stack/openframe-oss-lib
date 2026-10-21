package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.EventHandlerType;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
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
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class TenantSoftwareHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final TenantSoftwareRepository tenantSoftwareRepository;
    private final FleetSoftwareTitleRepository softwareTitleRepository;
    private final TenantSoftwareCveAggregator tenantSoftwareCveAggregator;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_TENANT_SOFTWARE;
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
            log.warn("[software-cdc] software_titles_host_counts without resolved tenant — dropping (team_id={})",
                    str(row, "team_id"));
            return;
        }
        Long softwareTitleId = longOrNull(row, "software_title_id");
        if (softwareTitleId == null) {
            return;
        }

        if (delete) {
            tenantSoftwareRepository.deleteByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
            log.debug("[software-cdc] tenant_software removed: tenant={} title={}", tenantId, softwareTitleId);
            return;
        }

        TenantSoftware tenantSoftware = tenantSoftwareRepository
                .findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElseGet(TenantSoftware::new);
        tenantSoftware.setTenantId(tenantId);
        tenantSoftware.setSoftwareTitleId(softwareTitleId);
        tenantSoftware.setDevicesCount(intOr(row, "hosts_count", 0));
        applyTitle(tenantSoftware, softwareTitleId);
        tenantSoftware.setUpdatedAt(Instant.now());
        tenantSoftwareRepository.save(tenantSoftware);
        tenantSoftwareCveAggregator.recompute(tenantId, softwareTitleId);
        log.debug("[software-cdc] tenant_software upserted: tenant={} title={} devices={}",
                tenantId, softwareTitleId, tenantSoftware.getDevicesCount());
    }

    private void applyTitle(TenantSoftware tenantSoftware, Long softwareTitleId) {
        softwareTitleRepository.findBySoftwareTitleId(softwareTitleId).ifPresent(title -> {
            tenantSoftware.setName(title.getName());
            tenantSoftware.setNameLower(title.getNameLower());
            tenantSoftware.setSource(title.getSource());
            tenantSoftware.setBrowser(title.getBrowser());
        });
    }
}
