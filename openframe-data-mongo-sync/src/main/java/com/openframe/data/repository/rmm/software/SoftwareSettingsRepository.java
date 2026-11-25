package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SoftwareSettingsRepository extends MongoRepository<SoftwareSettings, String> {

    Optional<SoftwareSettings> findByTenantId(String tenantId);
}
