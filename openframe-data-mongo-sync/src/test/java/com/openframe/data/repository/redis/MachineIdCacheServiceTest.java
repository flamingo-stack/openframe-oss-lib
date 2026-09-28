package com.openframe.data.repository.redis;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineIdCacheServiceTest {

    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String TENANT_ID = "tenant-1";
    private static final String AGENT_TOOL_ID = "node-42";

    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private CacheManager cacheManager;
    @Mock private Cache machineByIdCache;
    @Mock private Cache machineCache;
    @Mock private Cache tenantMachineCache;

    private MachineIdCacheService service;

    @BeforeEach
    void setUp() {
        service = new MachineIdCacheService(toolConnectionRepository, machineRepository, organizationRepository,
                cacheManager);
    }

    private static ToolConnection meshCentralConnection() {
        ToolConnection connection = new ToolConnection();
        connection.setTenantId(TENANT_ID);
        connection.setMachineId(MACHINE_ID);
        connection.setToolType(ToolType.MESHCENTRAL);
        connection.setAgentToolId(AGENT_TOOL_ID);
        return connection;
    }

    @Test
    @DisplayName("evictMachine: evicts every key the enrichment reads through — by machineId, by agent, and the tenant-scoped agent key")
    void evictMachine_evictsEveryKeyTheEnrichmentReadsThrough() {
        when(cacheManager.getCache("machineByIdCache")).thenReturn(machineByIdCache);
        when(cacheManager.getCache("machineCache")).thenReturn(machineCache);
        when(cacheManager.getCache("tenantMachineCache")).thenReturn(tenantMachineCache);
        when(toolConnectionRepository.findByMachineId(MACHINE_ID)).thenReturn(List.of(meshCentralConnection()));

        service.evictMachine(MACHINE_ID);

        verify(machineByIdCache).evict(MACHINE_ID);
        verify(machineCache).evict(AGENT_TOOL_ID);
        // Same shape as the @Cacheable SpEL key: tenantId + ':' + toolType + ':' + agentId
        verify(tenantMachineCache).evict("tenant-1:MESHCENTRAL:node-42");
    }

    @Test
    @DisplayName("evictMachine: a machine with no tool connections only evicts the machineId entry")
    void evictMachine_noToolConnections_onlyEvictsById() {
        when(cacheManager.getCache("machineByIdCache")).thenReturn(machineByIdCache);
        when(toolConnectionRepository.findByMachineId(MACHINE_ID)).thenReturn(List.of());

        service.evictMachine(MACHINE_ID);

        verify(machineByIdCache).evict(MACHINE_ID);
        verifyNoInteractions(machineCache, tenantMachineCache);
    }

    @Test
    @DisplayName("evictMachine: a cache that is not configured is skipped instead of failing the invalidation")
    void evictMachine_toleratesUnconfiguredCache() {
        when(cacheManager.getCache("machineByIdCache")).thenReturn(null);
        when(toolConnectionRepository.findByMachineId(MACHINE_ID)).thenReturn(List.of());

        assertThatCode(() -> service.evictMachine(MACHINE_ID)).doesNotThrowAnyException();
    }
}
