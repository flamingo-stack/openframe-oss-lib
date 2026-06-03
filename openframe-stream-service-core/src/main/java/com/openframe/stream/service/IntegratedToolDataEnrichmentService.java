package com.openframe.stream.service;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class IntegratedToolDataEnrichmentService implements DataEnrichmentService<DeserializedDebeziumMessage> {

    private final MachineIdCacheService machineIdCacheService;
    private final ClusterTenantIdResolver clusterTenantIdResolver;
    private final TenantIdProvider tenantIdProvider;

    public IntegratedToolDataEnrichmentService(MachineIdCacheService machineIdCacheService,
                                               @Autowired(required = false) ClusterTenantIdResolver clusterTenantIdResolver,
                                               TenantIdProvider tenantIdProvider) {
        this.machineIdCacheService = machineIdCacheService;
        this.clusterTenantIdResolver = clusterTenantIdResolver;
        this.tenantIdProvider = tenantIdProvider;
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
     * Resolve tenantId for the event. Tenant clusters always use
     * {@link TenantIdProvider} (one tenant per cluster). Shared clusters supply
     * a {@link ClusterTenantIdResolver} bean that maps the message's
     * cluster-scoped identifier ({@link DeserializedDebeziumMessage#getTenantId()},
     * e.g. MeshCentral {@code domain}) to a canonical tenantId.
     */
    private void enrichFromTenant(DeserializedDebeziumMessage message, IntegratedToolEnrichedData enriched) {
        if (clusterTenantIdResolver == null) {
            enriched.setTenantId(tenantIdProvider.getTenantId());
            message.setTenantId(enriched.getTenantId());
            return;
        }
        String tenantId = clusterTenantIdResolver.resolveTenantId(message.getTenantId());
        enriched.setTenantId(tenantId);
        message.setTenantId(enriched.getTenantId());
    }

    @Override
    public DataEnrichmentServiceType getType() {
        return DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS;
    }
}
