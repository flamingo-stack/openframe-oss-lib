package com.openframe.data.repository.tenant;

import com.openframe.data.document.tenant.TenantClusterRegistration;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TenantClusterRegistrationRepository extends MongoRepository<TenantClusterRegistration, String> {
    boolean existsByTenantIdIsNull();
    Optional<TenantClusterRegistration> findFirstByTenantIdIsNull();
}
