package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OsUpdatePolicyRepository extends MongoRepository<OsUpdatePolicy, String> {

    List<OsUpdatePolicy> findByTenantIdOrderByCreatedAtAsc(String tenantId);

    Optional<OsUpdatePolicy> findByTenantIdAndId(String tenantId, String id);

    List<OsUpdatePolicy> findByTenantIdAndTargetMachineIdsContaining(String tenantId, String machineId);
}
