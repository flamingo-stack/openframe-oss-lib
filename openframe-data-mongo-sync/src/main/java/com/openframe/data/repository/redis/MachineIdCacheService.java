package com.openframe.data.repository.redis;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Service for machine and organization cache operations using Spring Cache abstraction
 * Uses lightweight DTOs to avoid serialization issues and reduce cache size
 * Only enabled when MongoDB repositories are available (servlet-based applications)
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "openframe.machine-id.cache.enabled", havingValue = "true")
public class MachineIdCacheService {

    public static final String INVALIDATION_CHANNEL = "machine:cache:invalidate";

    private static final String MACHINE_CACHE = "machineCache";
    private static final String TENANT_MACHINE_CACHE = "tenantMachineCache";
    private static final String MACHINE_BY_ID_CACHE = "machineByIdCache";
    private static final String KEY_SEPARATOR = ":";

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;
    private final CacheManager cacheManager;

    /**
     * Get cached machine info from cache or database by agent ID
     * Returns only essential fields (machineId, hostname, nickname, organizationId)
     *
     * @param agentId the agent ID
     * @return the CachedMachineInfo object, or null if not found
     */
    @Cacheable(value = MACHINE_CACHE, key = "#agentId", unless = "#result == null")
    public CachedMachineInfo getMachine(String agentId) {
        log.debug("Fetching machine info for agent: {}", agentId);
        try {
            // Get the most recent machineId from ToolConnection
            return toolConnectionRepository.findFirstByAgentToolIdOrderByConnectedAtDesc(agentId)
                .map(ToolConnection::getMachineId)
                .flatMap(machineRepository::findByMachineId)
                .map(machine -> new CachedMachineInfo(
                    machine.getMachineId(),
                    machine.getHostname(),
                    machine.getNickname(),
                    machine.getOrganizationId()
                ))
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine info for agent: {}", agentId, e);
            return null;
        }
    }

    @Cacheable(value = TENANT_MACHINE_CACHE, key = "#tenantId + ':' + #toolType + ':' + #agentId", unless = "#result == null")
    public CachedMachineInfo getMachine(String tenantId, ToolType toolType, String agentId) {
        log.debug("Fetching machine info for agent: {} (tenant: {}, tool: {})", agentId, tenantId, toolType);
        try {
            return toolConnectionRepository
                .findFirstByTenantIdAndToolTypeAndAgentToolIdOrderByConnectedAtDesc(tenantId, toolType, agentId)
                .map(ToolConnection::getMachineId)
                .flatMap(machineRepository::findByMachineId)
                .map(machine -> new CachedMachineInfo(
                    machine.getMachineId(),
                    machine.getHostname(),
                    machine.getNickname(),
                    machine.getOrganizationId()
                ))
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine info for agent: {} (tenant: {}, tool: {})", agentId, tenantId, toolType, e);
            return null;
        }
    }

    /**
     * Get cached machine info by openframe-native machineId — skips the
     * {@link ToolConnection} indirection used by {@link #getMachine(String)}.
     *
     * @param machineId openframe-native machineId
     * @return the {@link CachedMachineInfo}, or {@code null} if the machine is not found in the local store
     */
    @Cacheable(value = MACHINE_BY_ID_CACHE, key = "#machineId", unless = "#result == null")
    public CachedMachineInfo getMachineByMachineId(String machineId) {
        log.debug("Fetching machine info by machineId: {}", machineId);
        try {
            return machineRepository.findByMachineId(machineId)
                .map(machine -> new CachedMachineInfo(
                    machine.getMachineId(),
                    machine.getHostname(),
                    machine.getNickname(),
                    machine.getOrganizationId()
                ))
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine info by machineId: {}", machineId, e);
            return null;
        }
    }

    /**
     * Get cached organization info from cache or database by organization ID
     * Returns only essential fields (organizationId, name)
     *
     * @param organizationId the organization ID
     * @return the CachedOrganizationInfo object, or null if not found
     */
    @Cacheable(value = "organizationCache", key = "#organizationId", unless = "#result == null")
    public CachedOrganizationInfo getOrganization(String organizationId) {
        log.debug("Fetching organization info for ID: {}", organizationId);
        try {
            return organizationRepository.findByOrganizationId(organizationId)
                .map(org -> new CachedOrganizationInfo(
                    org.getOrganizationId(),
                    org.getName()
                ))
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching organization info for ID: {}", organizationId, e);
            return null;
        }
    }

    public void evictMachine(String machineId) {
        evict(MACHINE_BY_ID_CACHE, machineId);
        List<ToolConnection> connections = toolConnectionRepository.findByMachineId(machineId);
        connections.forEach(this::evictConnectionEntries);
        log.info("Evicted cached machine info: machineId={} toolConnections={}", machineId, connections.size());
    }

    private void evictConnectionEntries(ToolConnection connection) {
        String agentToolId = connection.getAgentToolId();
        String tenantMachineKey = tenantMachineKey(connection);
        evict(MACHINE_CACHE, agentToolId);
        evict(TENANT_MACHINE_CACHE, tenantMachineKey);
    }

    private String tenantMachineKey(ToolConnection connection) {
        return connection.getTenantId() + KEY_SEPARATOR + connection.getToolType()
                + KEY_SEPARATOR + connection.getAgentToolId();
    }

    private void evict(String cacheName, String key) {
        Cache cache = cacheManager.getCache(cacheName);
        if (cache == null) {
            return;
        }
        cache.evict(key);
    }
}

