package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.TenantSoftware;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantSoftwareRepository extends MongoRepository<TenantSoftware, String> {

    Optional<TenantSoftware> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    List<TenantSoftware> findByTenantIdAndSoftwareTitleIdIn(String tenantId, List<Long> softwareTitleIds);

    long deleteByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);
}
