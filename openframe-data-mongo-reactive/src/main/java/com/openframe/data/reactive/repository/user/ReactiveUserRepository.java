package com.openframe.data.reactive.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.user.BaseUserRepository;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface ReactiveUserRepository extends ReactiveMongoRepository<User, String>, BaseUserRepository<Mono<User>, Mono<Boolean>, String> {
    @Override
    Mono<User> findByEmail(String email);

    @Override
    Mono<Boolean> existsByEmail(String email);

    @Override
    Mono<Boolean> existsByEmailAndStatus(String email, UserStatus status);

    /**
     * Whether a user with the given id exists in the given tenant. Tenant-first form because the
     * shared/SaaS side bypasses the tenant aspect and must scope by tenant explicitly.
     */
    Mono<Boolean> existsByTenantIdAndId(String tenantId, String id);
} 