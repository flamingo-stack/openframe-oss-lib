package com.openframe.repository.auth;

import com.openframe.document.auth.TenantKey;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantKeyRepository extends MongoRepository<TenantKey, String> {
    Optional<TenantKey> findFirstByTenantIdAndActiveTrue(String tenantId);

    long countByTenantIdAndActiveTrue(String tenantId);
}
