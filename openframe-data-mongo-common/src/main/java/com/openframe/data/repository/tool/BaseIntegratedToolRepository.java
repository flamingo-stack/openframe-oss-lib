package com.openframe.data.repository.tool;
// Base interface for integrated tool repositories; T/B/ID vary by blocking vs reactive implementations.
public interface BaseIntegratedToolRepository<T, B, ID> {
    /**
     * Find an integrated tool by its type.
     *
     * @param type The tool type to search for
     * @return The tool wrapped in T (Optional<IntegratedTool> for blocking, Mono<IntegratedTool> for reactive)
     */
    T findByType(String type);
    /**
     * Find an integrated tool by its human-readable key (e.g. "fleetmdm-server").
     * TenantAwareMongoTemplate auto-injects tenantId for tenant-side services.
     */
    T findByKey(String key);
} 
