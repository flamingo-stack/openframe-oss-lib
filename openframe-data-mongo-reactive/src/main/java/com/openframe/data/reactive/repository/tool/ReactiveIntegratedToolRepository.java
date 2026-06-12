package com.openframe.data.reactive.repository.tool;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.tool.BaseIntegratedToolRepository;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface ReactiveIntegratedToolRepository extends ReactiveMongoRepository<IntegratedTool, String>, BaseIntegratedToolRepository<Mono<IntegratedTool>, Mono<Boolean>, String> {
    @Override
    Mono<IntegratedTool> findByType(String type);

    @Override
    Mono<IntegratedTool> findByKey(String key);

    /**
     * Tenant-scoped tool lookup for a shared multi-tenant gateway. {@code IntegratedTool} is
     * tenant-scoped ({@code {tenantId, key}} unique), so on a shared store {@link #findByKey(String)}
     * alone would return another tenant's tool (and credentials); callers with a resolved tenant use this.
     */
    Mono<IntegratedTool> findByTenantIdAndKey(String tenantId, String key);
} 