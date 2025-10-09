package com.openframe.data.service;

import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Service for machine and organization cache operations using Spring Cache abstraction
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MachineIdCacheService {

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;

    /**
     * Get machine ID from cache or database
     * 
     * @param agentId the agent ID
     * @return the machine ID, or null if not found
     */
    @Cacheable(value = "machineIdCache", key = "#agentId", unless = "#result == null")
    public String getMachineId(String agentId) {
        log.debug("Fetching machine ID for agent: {}", agentId);
        try {
            return toolConnectionRepository.findByAgentToolId(agentId)
                .map(ToolConnection::getMachineId)
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine ID for agent: {}", agentId, e);
            return null;
        }
    }

    /**
     * Get full Machine object from cache or database by agent ID
     * 
     * @param agentId the agent ID
     * @return the Machine object, or null if not found
     */
    @Cacheable(value = "machineCache", key = "#agentId", unless = "#result == null")
    public Machine getMachine(String agentId) {
        log.debug("Fetching machine for agent: {}", agentId);
        try {
            // First get the machineId from ToolConnection
            return toolConnectionRepository.findByAgentToolId(agentId)
                .map(ToolConnection::getMachineId)
                .flatMap(machineRepository::findByMachineId)
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine for agent: {}", agentId, e);
            return null;
        }
    }

    /**
     * Get Organization object from cache or database by organization ID
     * 
     * @param organizationId the organization ID
     * @return the Organization object, or null if not found
     */
    @Cacheable(value = "organizationCache", key = "#organizationId", unless = "#result == null")
    public Organization getOrganization(String organizationId) {
        log.debug("Fetching organization for ID: {}", organizationId);
        try {
            return organizationRepository.findByOrganizationId(organizationId)
                .orElse(null);
        } catch (Exception e) {
            log.error("Error fetching organization for ID: {}", organizationId, e);
            return null;
        }
    }
}


