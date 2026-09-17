package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareBundleRepository extends MongoRepository<SoftwareBundle, String> {

    Optional<SoftwareBundle> findByTenantIdAndId(String tenantId, String id);

    List<SoftwareBundle> findByTenantIdOrderByIdDesc(String tenantId);

    List<SoftwareBundle> findByTenantIdAndStatusOrderByIdDesc(String tenantId, SoftwareBundleStatus status);
}
