package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PackageUpdateRequestRepository extends MongoRepository<PackageUpdateRequest, String> {

    Optional<PackageUpdateRequest> findByTenantIdAndRequestId(String tenantId, String requestId);

    List<PackageUpdateRequest> findByTenantIdAndStatus(String tenantId, SoftwareActionStatus status);

    long deleteByTenantIdAndRequestId(String tenantId, String requestId);
}
