package com.openframe.data.repository.tenant;

/**
 * Base interface defining common tenant repository operations.
 * This interface is technology-agnostic and can be implemented by both reactive and non-reactive repositories.
 *
 * @param <T>  The return type wrapper ({@code Optional} for blocking, {@code Mono} for reactive)
 * @param <B>  The boolean return type ({@code boolean} for blocking, {@code Mono<Boolean>} for reactive)
 * @param <ID> The ID type (String in our case)
 */
public interface BaseTenantRepository<T, B, ID> {
    /**
     * Find a tenant by their domain.
     *
     * @param domain The domain to search for
     * @return The tenant wrapped in T ({@code Optional<Tenant>} for blocking, {@code Mono<Tenant>} for reactive)
     */
    T findByDomain(String domain);

    /**
     * Check if a tenant exists with the given domain.
     *
     * @param domain The domain to check
     * @return {@code Boolean} ({@code boolean} for blocking, {@code Mono<Boolean>} for reactive)
     */
    B existsByDomain(String domain);
}