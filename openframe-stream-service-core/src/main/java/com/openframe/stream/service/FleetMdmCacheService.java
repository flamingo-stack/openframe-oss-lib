package com.openframe.stream.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.IntegratedToolId;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.sdk.fleetmdm.model.Query;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.apache.commons.lang3.StringUtils.defaultIfBlank;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

/**
 * Service for Fleet MDM cache operations using Spring Cache abstraction
 * Used in Fleet activities stream processing for enriching activities with:
 * - Agent information (host-to-agent mapping)
 * - Query definitions (query metadata by ID)
 * <p>
 * Uses Fleet MDM SDK directly instead of database access
 *
 * <p><b>Tenant model.</b> In per-tenant clusters one client carries the deployment's
 * {@code TENANT_ID} as the {@code X-Tenant-Id} header. In the shared cluster (a
 * {@link ClusterTenantIdResolver} bean is present) there is no deployment tenant — callers pass
 * the EVENT's resolved tenant and a per-tenant client (same base URL and API token, different
 * header) is used, because the shared Fleet's fences 404 a lookup made under the wrong tenant.
 * Cache keys stay id-only: host/query/policy ids are globally unique in the shared MySQL, so
 * the cached value is tenant-independent.
 */
@Service
@Slf4j
public class FleetMdmCacheService {

    /**
     * Static Fleet base URL. Optional: in the shared plane the URL is resolved per
     * tenant by {@link FleetBaseUrlResolver}.
     */
    @Value("${fleet.mdm.base-url:}")
    private String baseUrl;

    @Value("${TENANT_ID:}")
    private String tenantId;

    @Value("${openframe.fleet.multi-tenancy.enabled:false}")
    private boolean fleetMultiTenancyEnabled;

    private FleetMdmClient fleetMdmClient;
    private final Map<String, FleetMdmClient> clientByTenant = new ConcurrentHashMap<>();
    private volatile String cachedApiKey;

    private final IntegratedToolService integratedToolService;
    private final ClusterTenantIdResolver clusterTenantIdResolver;
    private final FleetBaseUrlResolver fleetBaseUrlResolver;

    public FleetMdmCacheService(IntegratedToolService integratedToolService,
                                @Autowired(required = false) ClusterTenantIdResolver clusterTenantIdResolver,
                                @Autowired(required = false) FleetBaseUrlResolver fleetBaseUrlResolver) {
        this.integratedToolService = integratedToolService;
        this.clusterTenantIdResolver = clusterTenantIdResolver;
        this.fleetBaseUrlResolver = fleetBaseUrlResolver;
    }

    @PostConstruct
    void validateTenantConfig() {
        if (fleetBaseUrlResolver == null && isBlank(baseUrl)) {
            throw new IllegalStateException(
                    "fleet.mdm.base-url must be configured when no FleetBaseUrlResolver bean is "
                            + "present to resolve the Fleet URL per tenant");
        }
        // Shared cluster (per-event tenants via ClusterTenantIdResolver): a blank deployment
        // TENANT_ID is expected — every SDK call carries the event's own tenant instead — and
        // the Fleet URL is resolved per tenant too, so fleet.mdm.base-url may legitimately be
        // absent here.
        if (clusterTenantIdResolver != null) {
            return;
        }
        // Per-tenant cluster: Fleet is in-cluster and reachable only through the static
        // property (no FleetBaseUrlResolver is deployed to derive it per tenant). A blank value
        // would silently disable every enrichment lookup, so fail fast instead.
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException(
                    "fleet.mdm.base-url must be configured in a per-tenant deployment "
                            + "(no FleetBaseUrlResolver is present to resolve it per tenant)");
        }
        FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantId);
    }

    /**
     * Get agent ID from cache or Fleet MDM API
     *
     * @param hostId the host ID
     * @return the agent ID, or null if not found
     */
    @Cacheable(value = "hostAgentCache", key = "#hostId", unless = "#result == null")
    public String getAgentId(Integer hostId) {
        return getAgentId(hostId, null);
    }

    /**
     * Tenant-aware variant for the shared cluster: {@code eventTenantId} is the event's resolved
     * tenant (null falls back to the deployment client). The tenant participates in the cache
     * key: ids are globally unique on today's single shared MySQL, but tenant-scoped keys stay
     * correct if the DB ever shards per cluster (ids unique per shard only) and on dev where
     * several SHARED_DOMAIN environments share one Redis.
     */
    @Cacheable(value = "hostAgentCache", key = "(#eventTenantId ?: 'default') + ':' + #hostId", unless = "#result == null")
    public String getAgentId(Integer hostId, String eventTenantId) {
        log.debug("Fetching agent ID for host: {}", hostId);
        try {
            FleetMdmClient client = clientFor(eventTenantId);
            Host host = client != null ? client.getHostById(hostId.longValue()) : null;
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
        return getQueryById(queryId, null);
    }

    /**
     * Tenant-aware variant for the shared cluster (see class javadoc; tenant-scoped cache key).
     */
    @Cacheable(value = "fleetQueryCache", key = "(#eventTenantId ?: 'default') + ':' + #queryId", unless = "#result == null")
    public Query getQueryById(Long queryId, String eventTenantId) {
        log.debug("Cache miss for query_id: {}, calling Fleet MDM API", queryId);
        try {
            FleetMdmClient client = clientFor(eventTenantId);
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
    /**
     * Evict a policy from cache. Call when a policy mutation event is detected
     * (edited_policy, deleted_policy, etc.) to ensure fresh data on next lookup.
     *
     * @param policyId the policy ID to evict
     */
    @CacheEvict(value = "fleetPolicyCache", key = "#policyId")
    public void evictPolicyCache(Long policyId) {
        log.debug("Evicted policy cache for policy_id: {}", policyId);
    }

    /**
     * Tenant-aware evict matching the tenant-scoped cache key of {@link #getPolicyById(Long, String)}.
     */
    @CacheEvict(value = "fleetPolicyCache", key = "(#eventTenantId ?: 'default') + ':' + #policyId")
    public void evictPolicyCache(Long policyId, String eventTenantId) {
        log.debug("Evicted policy cache for policy_id: {} tenant: {}", policyId, eventTenantId);
    }

    @Cacheable(value = "fleetPolicyCache", key = "#policyId", unless = "#result == null || !#result.isPresent()")
    public Optional<Policy> getPolicyById(Long policyId) {
        return getPolicyById(policyId, null);
    }

    /**
     * Tenant-aware variant for the shared cluster (see class javadoc; tenant-scoped cache key).
     */
    @Cacheable(value = "fleetPolicyCache", key = "(#eventTenantId ?: 'default') + ':' + #policyId", unless = "#result == null || !#result.isPresent()")
    public Optional<Policy> getPolicyById(Long policyId, String eventTenantId) {
        log.debug("Cache miss for policy_id: {}, calling Fleet MDM API", policyId);
        try {
            FleetMdmClient client = clientFor(eventTenantId);
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

    // Per-tenant clusters only: reached from clientFor when no ClusterTenantIdResolver is
    // deployed. validateTenantConfig has already guaranteed a non-blank baseUrl on that path.
    private FleetMdmClient getFleetMdmClient() {
        if (fleetMdmClient == null) {
            String apiKey = resolveApiKey();
            if (apiKey == null) {
                return null;
            }
            log.info("Initializing FleetMdmClient with baseUrl: {}", baseUrl);
            this.fleetMdmClient = new FleetMdmClient(baseUrl, apiKey, tenantId);
        }
        return fleetMdmClient;
    }

    /**
     * Client for the given event tenant. Blank/null tenant (per-tenant clusters, or an event
     * whose tenant could not be resolved) falls back to the deployment client. Per-tenant
     * clients share the tool credential and base URL and differ only in the X-Tenant-Id header.
     */
    private FleetMdmClient clientFor(String eventTenantId) {
        if (isBlank(eventTenantId)) {
            return clientForUnresolvedTenant();
        }
        return clientByTenant.computeIfAbsent(eventTenantId, this::buildTenantClient);
    }

    private FleetMdmClient clientForUnresolvedTenant() {
        if (clusterTenantIdResolver != null) {
            log.debug("No event tenant resolved — skipping Fleet API lookup in shared cluster");
            return null;
        }
        return getFleetMdmClient();
    }

    private FleetMdmClient buildTenantClient(String tenant) {
        String tenantBaseUrl = baseUrlFor(tenant);
        if (tenantBaseUrl == null) {
            log.debug("No Fleet base URL for tenant {} — skipping Fleet API lookup", tenant);
            return null;
        }
        String apiKey = resolveApiKey();
        if (apiKey == null) {
            return null;
        }
        log.info("Initializing FleetMdmClient for tenant {} with baseUrl: {}", tenant, tenantBaseUrl);
        return new FleetMdmClient(tenantBaseUrl, apiKey, tenant);
    }

    String baseUrlFor(String tenantId) {
        if (fleetBaseUrlResolver == null) {
            return defaultIfBlank(baseUrl, null);
        }
        String resolved = fleetBaseUrlResolver.resolveBaseUrl(tenantId);
        if (isNotBlank(resolved)) {
            return resolved;
        }
        if (isNotBlank(baseUrl)) {
            log.warn("No per-tenant Fleet base URL for tenant {} — falling back to the static base url", tenantId);
            return baseUrl;
        }
        return null;
    }

    private String resolveApiKey() {
        if (cachedApiKey != null) {
            return cachedApiKey;
        }
        Optional<IntegratedTool> optionalFleetInfo = integratedToolService.getToolByKey(IntegratedToolId.FLEET_SERVER_ID.getValue());
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
        cachedApiKey = tool.getCredentials().getApiKey().getKey();
        return cachedApiKey;
    }
}

