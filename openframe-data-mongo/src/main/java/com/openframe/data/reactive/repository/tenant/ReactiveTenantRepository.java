package com.openframe.data.reactive.repository.tenant;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.BaseTenantRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
public interface ReactiveTenantRepository extends ReactiveMongoRepository<Tenant, String>, BaseTenantRepository<Mono<Tenant>, Mono<Boolean>, String> {

    @Override
    Mono<Tenant> findByDomain(String domain);

    @Override
    Mono<Boolean> existsByDomain(String domain);
}