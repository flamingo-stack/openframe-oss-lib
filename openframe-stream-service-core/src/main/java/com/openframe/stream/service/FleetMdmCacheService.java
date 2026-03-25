package com.openframe.stream.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.sdk.fleetmdm.model.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Optional;

/**
 * Service for Fleet MDM cache operations using Spring Cache abstraction
 * Used in Fleet activities stream processing for enriching activities with:
 * - Agent information (host-to-agent mapping)
 * - Query definitions (query metadata by ID)
 * 
 * Uses Fleet MDM SDK directly instead of database access
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FleetMdmCacheService {

    @Value("${fleet.mdm.base-url}")
    private String baseUrl;

    private FleetMdmClient fleetMdmClient;

    private final IntegratedToolService integratedToolService;

    /**
     * Get agent ID from cache or Fleet MDM API
     *
     * @param hostId the host ID
     * @return the agent ID, or null if not found
     */
    @Cacheable(value = "hostAgentCache", key = "#hostId", unless = "#result == null")
    public String getAgentId(Integer hostId) {
        log.debug("Fetching agent ID for host: {}", hostId);
        try {
            Host host = getFleetMdmClient() != null ? this.fleetMdmClient.getHostById(hostId.longValue()) : null;
            return host != null ? host.getUuid() : null;
        } catch (IOException | InterruptedException e) {
            log.error("Error fetching agent ID for host: {}", hostId, e);
            return null;
        }
    }

    /**
     * Get query definition from cache or Fleet MDM API
     *
     * @param queryId the query ID
     * @return the Query object, or null if not found
     */
    @Cacheable(value = "fleetQueryCache", key = "#queryId", unless = "#result == null")
    public Query getQueryById(Long queryId) {
        log.debug("Cache miss for query_id: {}, calling Fleet MDM API", queryId);
        try {
            FleetMdmClient client = getFleetMdmClient();
            if (client == null) {
                log.warn("FleetMdmClient is not initialized, cannot fetch query_id: {}", queryId);
                return null;
            }
            Query query = client.getQueryById(queryId);
            if (query != null) {
                log.debug("Successfully fetched query_id: {}, name: '{}'", queryId, query.getName());
            } else {
                log.warn("Fleet MDM API returned null for query_id: {} (query may have been deleted)", queryId);
            }
            return query;
        } catch (IOException | InterruptedException e) {
            log.error("Fleet MDM API call failed for query_id: {}. Cause: {}", queryId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * Get policy definition from cache or Fleet MDM API
     *
     * @param policyId the policy ID
     * @return the Policy object, or null if not found
     */
    @Cacheable(value = "fleetPolicyCache", key = "#policyId", unless = "#result == null || !#result.isPresent()")
    public Optional<Policy> getPolicyById(Long policyId) {
        log.debug("Cache miss for policy_id: {}, calling Fleet MDM API", policyId);
        try {
            FleetMdmClient client = getFleetMdmClient();
            if (client == null) {
                log.warn("FleetMdmClient is not initialized, cannot fetch policy_id: {}", policyId);
                return Optional.empty();
            }
            Optional<Policy> policy = Optional.ofNullable(client.getPolicyById(policyId));
            policy.ifPresentOrElse(
                    p -> log.debug("Successfully fetched policy_id: {}, name: '{}'", policyId, p.getName()),
                    () -> log.warn("Fleet MDM API returned null for policy_id: {} (policy may have been deleted)", policyId)
            );
            return policy;
        } catch (IOException | InterruptedException e) {
            log.error("Fleet MDM API call failed for policy_id: {}. Cause: {}", policyId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    private FleetMdmClient getFleetMdmClient() {
        if (fleetMdmClient == null) {
            Optional<IntegratedTool> optionalFleetInfo = integratedToolService.getToolById(IntegratedToolId.FLEET_SERVER_ID.getValue());
            if (optionalFleetInfo.isEmpty()) {
                log.warn("Fleet integration not found by ID '{}'. Query/policy name resolution will be unavailable.",
                        IntegratedToolId.FLEET_SERVER_ID.getValue());
                return null;
            }
            IntegratedTool tool = optionalFleetInfo.get();
            if (tool.getCredentials() == null || tool.getCredentials().getApiKey() == null) {
                log.warn("Fleet integration found but credentials/API key is missing. Query/policy name resolution will be unavailable.");
                return null;
            }
            log.info("Initializing FleetMdmClient with baseUrl: {}", baseUrl);
            this.fleetMdmClient = new FleetMdmClient(baseUrl, tool.getCredentials().getApiKey().getKey());
        }
        return fleetMdmClient;
    }
}

