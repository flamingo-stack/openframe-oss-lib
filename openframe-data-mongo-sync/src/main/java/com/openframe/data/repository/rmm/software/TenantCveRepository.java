package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.TenantCve;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantCveRepository extends MongoRepository<TenantCve, String> {

    Optional<TenantCve> findByTenantIdAndCveId(String tenantId, String cveId);

    List<TenantCve> findByTenantIdAndCveIdIn(String tenantId, List<String> cveIds);

    List<TenantCve> findByCveId(String cveId);

    long deleteByTenantIdAndCveId(String tenantId, String cveId);
}
