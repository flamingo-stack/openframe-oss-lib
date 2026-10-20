package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareRepository extends MongoRepository<Software, String> {

    Optional<Software> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    void deleteByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    List<Software> findByInstallationsSoftwareId(Long softwareId);

    List<Software> findBySoftwareTitleId(Long softwareTitleId);

    List<Software> findByTenantIdAndInstallationsMachineId(String tenantId, String machineId);

    Page<Software> findByTenantIdAndDevicesCountGreaterThan(String tenantId, int min, Pageable pageable);

    Page<Software> findByTenantIdAndNameLowerContainingAndDevicesCountGreaterThan(
            String tenantId, String nameLower, int min, Pageable pageable);

    Page<Software> findByTenantIdAndCveCountGreaterThanAndDevicesCountGreaterThan(
            String tenantId, int minCve, int minDevices, Pageable pageable);

    Page<Software> findByTenantIdAndNameLowerContainingAndCveCountGreaterThanAndDevicesCountGreaterThan(
            String tenantId, String nameLower, int minCve, int minDevices, Pageable pageable);
}
