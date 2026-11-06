package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareRepository extends MongoRepository<Software, String>, CustomSoftwareRepository {

    Optional<Software> findByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    boolean existsByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    void deleteByTenantIdAndSoftwareTitleId(String tenantId, Long softwareTitleId);

    List<Software> findByTenantIdAndInstallationsMachineId(String tenantId, String machineId);
}
