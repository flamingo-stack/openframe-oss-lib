package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.TenantSoftware;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantSoftwareRepository extends MongoRepository<TenantSoftware, String> {

    Optional<TenantSoftware> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    List<TenantSoftware> findByTenantIdAndSoftwareTitleIdIn(String tenantId, List<Long> softwareTitleIds);

    // Cross-tenant: a title is global, so a name change fans out to every tenant that has it.
    List<TenantSoftware> findBySoftwareTitleId(Long softwareTitleId);

    long deleteByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    Page<TenantSoftware> findByTenantIdAndDevicesCountGreaterThan(String tenantId, int minDevices, Pageable pageable);

    Page<TenantSoftware> findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
            String tenantId, String nameLower, int minDevices, Pageable pageable);

    Page<TenantSoftware> findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(
            String tenantId, int minCve, int minDevices, Pageable pageable);

    Page<TenantSoftware> findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
            String tenantId, String nameLower, int minCve, int minDevices, Pageable pageable);
}
