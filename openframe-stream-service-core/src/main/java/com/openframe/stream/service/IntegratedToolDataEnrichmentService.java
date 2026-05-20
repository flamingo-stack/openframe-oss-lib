package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.repository.redis.TenantIdCacheService;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class IntegratedToolDataEnrichmentService implements DataEnrichmentService<DeserializedDebeziumMessage> {

    private final MachineIdCacheService machineIdCacheService;
    private final TenantIdCacheService tenantIdCacheService;

    public IntegratedToolDataEnrichmentService(MachineIdCacheService machineIdCacheService,
                                               @Autowired(required = false) TenantIdCacheService tenantIdCacheService) {
        this.machineIdCacheService = machineIdCacheService;
        this.tenantIdCacheService = tenantIdCacheService;
    }

    @Override
    public IntegratedToolEnrichedData getExtraParams(DeserializedDebeziumMessage message) {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        if (message == null) {
            return enriched;
        }

        enrichFromMachine(message, enriched);
        enrichFromTenant(message, enriched);
        return enriched;
    }

    private void enrichFromMachine(DeserializedDebeziumMessage message, IntegratedToolEnrichedData enriched) {
        String agentId = message.getAgentId();
        if (agentId == null) {
            return;
        }
        CachedMachineInfo machine = machineIdCacheService.getMachine(agentId);
        if (machine == null) {
            log.warn("Machine ID not found for agent: {}", agentId);
            return;
        }
        enriched.setMachineId(machine.getMachineId());
        enriched.setHostname(machine.getHostname());

        CachedOrganizationInfo organization = machineIdCacheService.getOrganization(machine.getOrganizationId());
        log.debug("Found machine ID {} for agent {} (organization {})",
                machine.getMachineId(), agentId, machine.getOrganizationId());
        if (organization != null) {
            enriched.setOrganizationId(organization.getOrganizationId());
            enriched.setOrganizationName(organization.getName());
        }
    }

    /**
     * Resolve tenantId from the event payload's {@code domain} field. When no
     * {@link TenantIdCacheService} bean is present (tenant cluster deployment),
     * the tenant is implicit and this is a no-op. In the shared SaaS cluster
     * the bean is configured: a missing/unknown domain marks the message as
     * {@code skipProcessing} so downstream handlers do not publish events
     * without a tenant attribution.
     */
    private void enrichFromTenant(DeserializedDebeziumMessage message, IntegratedToolEnrichedData enriched) {
        if (tenantIdCacheService == null) {
            return;
        }
        String tenantId = message.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            return;
        }
        enriched.setTenantId(tenantIdCacheService.getTenantId(tenantId));
    }

    @Override
    public DataEnrichmentServiceType getType() {
        return DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS;
    }
}
