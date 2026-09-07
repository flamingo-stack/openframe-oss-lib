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
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.NoSuchElementException;

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

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;

    /**
     * Get cached machine info from cache or database by agent ID
     * Returns only essential fields (machineId, hostname, organizationId)
     *
     * @param agentId the agent ID
     * @return the CachedMachineInfo object
     * @throws NoSuchElementException if no machine is found for the given agent ID
     */
    @Cacheable(value = "machineCache", key = "#agentId")
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
                .orElseThrow(() -> new NoSuchElementException("No machine found for agent: " + agentId));
        } catch (NoSuchElementException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching machine info for agent: {}", agentId, e);
            throw new IllegalStateException("Error fetching machine info for agent: " + agentId, e);
        }
    }

    @Cacheable(value = "tenantMachineCache", key = "#tenantId + ':' + #toolType + ':' + #agentId")
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
                    machine.getOrganizationId()
                ))
                .orElseThrow(() -> new NoSuchElementException(
                    "No machine found for agent: " + agentId + " (tenant: " + tenantId + ", tool: " + toolType + ")"));
        } catch (NoSuchElementException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching machine info for agent: {} (tenant: {}, tool: {})", agentId, tenantId, toolType, e);
            throw new IllegalStateException(
                "Error fetching machine info for agent: " + agentId + " (tenant: " + tenantId + ", tool: " + toolType + ")", e);
        }
    }

    /**
     * Get cached machine info by openframe-native machineId — skips the
     * {@link ToolConnection} indirection used by {@link #getMachine(String)}.
     *
     * @param machineId openframe-native machineId
     * @return the {@link CachedMachineInfo}
     * @throws NoSuchElementException if the machine is not found in the local store
     */
    @Cacheable(value = "machineByIdCache", key = "#machineId")
    public CachedMachineInfo getMachineByMachineId(String machineId) {
        log.debug("Fetching machine info by machineId: {}", machineId);
        try {
            return machineRepository.findByMachineId(machineId)
                .map(machine -> new CachedMachineInfo(
                    machine.getMachineId(),
                    machine.getHostname(),
                    machine.getOrganizationId()
                ))
                .orElseThrow(() -> new NoSuchElementException("No machine found for machineId: " + machineId));
        } catch (NoSuchElementException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching machine info by machineId: {}", machineId, e);
            throw new IllegalStateException("Error fetching machine info by machineId: " + machineId, e);
        }
    }

    /**
     * Get cached organization info from cache or database by organization ID
     * Returns only essential fields (organizationId, name)
     *
     * @param organizationId the organization ID
     * @return the CachedOrganizationInfo object
     * @throws NoSuchElementException if no organization is found for the given ID
     */
    @Cacheable(value = "organizationCache", key = "#organizationId")
    public CachedOrganizationInfo getOrganization(String organizationId) {
        log.debug("Fetching organization info for ID: {}", organizationId);
        try {
            return organizationRepository.findByOrganizationId(organizationId)
                .map(org -> new CachedOrganizationInfo(
                    org.getOrganizationId(),
                    org.getName()
                ))
                .orElseThrow(() -> new NoSuchElementException("No organization found for ID: " + organizationId));
        } catch (NoSuchElementException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching organization info for ID: {}", organizationId, e);
            throw new IllegalStateException("Error fetching organization info for ID: " + organizationId, e);
        }
    }
}

