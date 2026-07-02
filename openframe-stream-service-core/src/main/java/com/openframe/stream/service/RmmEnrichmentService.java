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

/**
 * Enrichment for native OpenFrame RMM execution-result events
 * ({@code MessageType.SCRIPT_EXECUTED}, and later {@code COMMAND_EXECUTED}).
 *
 * <p>Diverges from {@link IntegratedToolDataEnrichmentService} on the Machine
 * lookup only: native RMM events carry the openframe machineId directly as
 * {@code agentId}, so the {@code ToolConnection.agentToolId → machineId}
 * indirection used for external tools (MeshCentral, Fleet, Tactical) is
 * skipped — we resolve the {@code Machine} document by its own id. The
 * subsequent {@code Organization} lookup, tenant resolution, and the shape of
 * the returned {@link IntegratedToolEnrichedData} are identical to the
 * external-tool path.
 */
@Service
@Slf4j
public class RmmEnrichmentService implements DataEnrichmentService<DeserializedDebeziumMessage> {

    private final MachineIdCacheService machineIdCacheService;
    private final ClusterTenantIdResolver clusterTenantIdResolver;
    private final TenantIdProvider tenantIdProvider;

    public RmmEnrichmentService(MachineIdCacheService machineIdCacheService,
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
        String machineId = message.getAgentId();
        if (machineId == null) {
            return;
        }
        CachedMachineInfo machine = machineIdCacheService.getMachineByMachineId(machineId);
        if (machine == null) {
            log.warn("Native RMM event references unknown machineId: {}", machineId);
            return;
        }
        enriched.setMachineId(machine.getMachineId());
        enriched.setHostname(machine.getHostname());

        CachedOrganizationInfo organization = machineIdCacheService.getOrganization(machine.getOrganizationId());
        if (organization != null) {
            enriched.setOrganizationId(organization.getOrganizationId());
            enriched.setOrganizationName(organization.getName());
        }
    }

    /**
     * Mirrors {@link IntegratedToolDataEnrichmentService#enrichFromTenant}: tenant
     * clusters use {@link TenantIdProvider}; shared clusters supply a
     * {@link ClusterTenantIdResolver} bean.
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
        return DataEnrichmentServiceType.RMM_RESULTS;
    }
}
