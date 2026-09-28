package com.openframe.stream.service.rmm;

import com.fasterxml.jackson.databind.JsonNode;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptCreationSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.redis.MachineIdCacheService;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import com.openframe.stream.service.ClusterTenantIdResolver;
import com.openframe.stream.service.DataEnrichmentService;
import com.openframe.stream.service.IntegratedToolDataEnrichmentService;
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
 * indirection used for external tools (MeshCentral, Fleet) is
 * skipped — we resolve the {@code Machine} document by its own id. The
 * subsequent {@code Organization} lookup, tenant resolution, and the shape of
 * the returned {@link IntegratedToolEnrichedData} are identical to the
 * external-tool path.
 */
@Service
@Slf4j
public class RmmEnrichmentService implements DataEnrichmentService<DeserializedDebeziumMessage> {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_SCRIPT_ID = "scriptId";

    private final MachineIdCacheService machineIdCacheService;
    private final ClusterTenantIdResolver clusterTenantIdResolver;
    private final TenantIdProvider tenantIdProvider;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptRepository scriptRepository;

    public RmmEnrichmentService(MachineIdCacheService machineIdCacheService,
                                @Autowired(required = false) ClusterTenantIdResolver clusterTenantIdResolver,
                                TenantIdProvider tenantIdProvider,
                                ScriptExecutionRepository scriptExecutionRepository,
                                ScriptRepository scriptRepository) {
        this.machineIdCacheService = machineIdCacheService;
        this.clusterTenantIdResolver = clusterTenantIdResolver;
        this.tenantIdProvider = tenantIdProvider;
        this.scriptExecutionRepository = scriptExecutionRepository;
        this.scriptRepository = scriptRepository;
    }

    @Override
    public IntegratedToolEnrichedData getExtraParams(DeserializedDebeziumMessage message) {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        if (message == null) {
            return enriched;
        }

        enrichFromMachine(message, enriched);
        enrichFromExecution(message, enriched);
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
        enriched.setNickname(machine.getNickname());

        CachedOrganizationInfo organization = machineIdCacheService.getOrganization(machine.getOrganizationId());
        if (organization != null) {
            enriched.setOrganizationId(organization.getOrganizationId());
            enriched.setOrganizationName(organization.getName());
        }
    }

    // A script or software result names the script_executions row it belongs to. The row knows who
    // triggered the run and how; its script knows how it was created. Both stay null when unknown.
    private void enrichFromExecution(DeserializedDebeziumMessage message, IntegratedToolEnrichedData enriched) {
        JsonNode after = afterOf(message);
        String tenantId = text(after, FIELD_TENANT_ID);
        String executionId = text(after, FIELD_EXECUTION_ID);
        if (tenantId == null || executionId == null) {
            return;
        }
        try {
            ScriptExecution execution = scriptExecutionRepository
                    .findFirstByTenantIdAndExecutionId(tenantId, executionId)
                    .orElse(null);
            if (execution != null) {
                stampExecution(execution, enriched);
            }
            String scriptId = text(after, FIELD_SCRIPT_ID);
            if (scriptId == null && execution != null) {
                scriptId = execution.getScriptId();
            }
            if (scriptId == null) {
                return;
            }
            scriptRepository.findByTenantIdAndId(tenantId, scriptId)
                    .map(RmmEnrichmentService::creationSourceOf)
                    .ifPresent(enriched::setScriptCreationSource);
        } catch (Exception e) {
            log.warn("Failed to resolve the run origin for tenantId={} executionId={}", tenantId, executionId, e);
        }
    }

    private static void stampExecution(ScriptExecution execution, IntegratedToolEnrichedData enriched) {
        enriched.setUserId(execution.getInitiatedBy());
        ExecutionSource source = execution.getSource();
        enriched.setExecutionSource(source == null ? ExecutionSource.MANUAL.name() : source.name());
    }

    private static String creationSourceOf(Script script) {
        ScriptCreationSource creationSource = script.getCreationSource();
        return creationSource == null ? ScriptCreationSource.MANUAL.name() : creationSource.name();
    }

    private static JsonNode afterOf(DeserializedDebeziumMessage message) {
        return message.getPayload() == null ? null : message.getPayload().getAfter();
    }

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String textValue = value.asText();
        return textValue.isBlank() ? null : textValue;
    }

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
