package com.openframe.data.repository.redis;

import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.model.redis.CachedMachineInfo;
import com.openframe.data.model.redis.CachedOrganizationInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Service for machine and organization cache operations using Spring Cache abstraction
 * Uses lightweight DTOs to avoid serialization issues and reduce cache size
 * Only enabled when MongoDB repositories are available (servlet-based applications)
 */
@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnBean({ToolConnectionRepository.class, MachineRepository.class, OrganizationRepository.class})
public class MachineIdCacheService {

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;

    /**
     * Get cached machine info from cache or database by agent ID
     * Returns only essential fields (machineId, hostname, organizationId)
     * 
     * @param agentId the agent ID
     * @return the CachedMachineInfo object, or null if not found
     */
    @Cacheable(value = "machineCache", key = "#agentId", unless = "#result == null")
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
                    machine.getOrganizationId()
                ))
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine info for agent: {}", agentId, e);
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
}

