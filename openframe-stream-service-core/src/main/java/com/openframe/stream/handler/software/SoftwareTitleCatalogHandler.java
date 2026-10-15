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
import java.util.List;
import java.util.Objects;

import static com.openframe.stream.handler.software.FleetRowFields.isDelete;
import static com.openframe.stream.handler.software.FleetRowFields.longOrNull;
import static com.openframe.stream.handler.software.FleetRowFields.str;

@Component
@RequiredArgsConstructor
@Slf4j
public class SoftwareTitleCatalogHandler implements MessageHandler<DeserializedDebeziumMessage, IntegratedToolEnrichedData> {

    private final FleetSoftwareTitleRepository softwareTitleRepository;
    private final TenantSoftwareRepository tenantSoftwareRepository;

    @Override
    public EventHandlerType getType() {
        return EventHandlerType.COMMON_TYPE;
    }

    @Override
    public Destination getDestination() {
        return Destination.MONGO_SOFTWARE_TITLE_CATALOG;
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
        Long softwareTitleId = longOrNull(row, "id");
        if (softwareTitleId == null) {
            return;
        }

        if (delete) {
            softwareTitleRepository.deleteBySoftwareTitleId(softwareTitleId);
            log.debug("[software-cdc] fleet_software_title removed: {}", softwareTitleId);
            return;
        }

        String name = str(row, "name");
        String source = str(row, "source");
        String browser = str(row, "browser");

        FleetSoftwareTitle title = softwareTitleRepository.findBySoftwareTitleId(softwareTitleId)
                .orElseGet(FleetSoftwareTitle::new);
        boolean nameChanged = !Objects.equals(title.getName(), name)
                || !Objects.equals(title.getSource(), source)
                || !Objects.equals(title.getBrowser(), browser);

        title.setSoftwareTitleId(softwareTitleId);
        title.setName(name);
        title.setNameLower(name == null ? null : name.toLowerCase());
        title.setSource(source);
        title.setBrowser(browser);
        title.setBundleIdentifier(str(row, "bundle_identifier"));
        title.setUpdatedAt(Instant.now());
        softwareTitleRepository.save(title);

        if (nameChanged) {
            fanOutToTenants(softwareTitleId, title);
        }
    }

    private void fanOutToTenants(Long softwareTitleId, FleetSoftwareTitle title) {
        List<TenantSoftware> rows = tenantSoftwareRepository.findBySoftwareTitleId(softwareTitleId);
        if (rows.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (TenantSoftware row : rows) {
            row.setName(title.getName());
            row.setNameLower(title.getNameLower());
            row.setSource(title.getSource());
            row.setBrowser(title.getBrowser());
            row.setUpdatedAt(now);
        }
        tenantSoftwareRepository.saveAll(rows);
        log.debug("[software-cdc] title {} name fanned out to {} tenant_software rows",
                softwareTitleId, rows.size());
    }
}
