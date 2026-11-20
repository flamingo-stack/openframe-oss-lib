package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import org.springframework.data.domain.Limit;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PackageUpdateRequestRepository extends MongoRepository<PackageUpdateRequest, String> {

    Optional<PackageUpdateRequest> findByTenantIdAndRequestId(String tenantId, String requestId);

    List<PackageUpdateRequest> findByTenantIdAndStatus(String tenantId, SoftwareActionStatus status);

    List<PackageUpdateRequest> findByTenantIdAndActionAndSoftwareIdAndMachineIdsIn(
            String tenantId, SoftwareAction action, String softwareId, Collection<String> machineIds);

    List<PackageUpdateRequest> findByTenantIdAndActionAndStatusOrderByIdAsc(
            String tenantId, SoftwareAction action, SoftwareActionStatus status, Limit limit);

    List<PackageUpdateRequest> findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(
            String tenantId, SoftwareAction action, SoftwareActionStatus status, String afterId, Limit limit);

    long deleteByTenantIdAndRequestId(String tenantId, String requestId);
}
