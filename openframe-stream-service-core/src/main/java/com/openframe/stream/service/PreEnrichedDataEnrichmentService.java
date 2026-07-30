package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

/**
 * Passthrough enrichment for events whose producer already stamped tenant/organization/user
 * fields into the message (e.g. Microsoft 365 directory audit events polled per organization).
 * Unlike {@link IntegratedToolDataEnrichmentService} it performs no agent/machine lookup —
 * such events have no agent, so the deserialized message is the source of truth.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PreEnrichedDataEnrichmentService implements DataEnrichmentService<DeserializedDebeziumMessage> {

    private final TenantIdProvider tenantIdProvider;

    @Override
    public IntegratedToolEnrichedData getExtraParams(DeserializedDebeziumMessage message) {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        if (message == null) {
            return enriched;
        }
        enriched.setOrganizationId(message.getOrganizationId());
        enriched.setOrganizationName(message.getOrganizationName());
        enriched.setUserId(message.getUserId());

        String tenantId = StringUtils.isNotBlank(message.getTenantId())
                ? message.getTenantId()
                : tenantIdProvider.getTenantId();
        enriched.setTenantId(tenantId);
        message.setTenantId(tenantId);
        return enriched;
    }

    @Override
    public DataEnrichmentServiceType getType() {
        return DataEnrichmentServiceType.PRE_ENRICHED;
    }
}
