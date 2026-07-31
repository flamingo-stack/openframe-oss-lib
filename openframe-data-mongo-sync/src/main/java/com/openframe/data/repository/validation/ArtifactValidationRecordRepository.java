package com.openframe.data.repository.validation;

import com.openframe.data.document.validation.ArtifactValidationRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ArtifactValidationRecordRepository extends MongoRepository<ArtifactValidationRecord, String> {

    Optional<ArtifactValidationRecord> findByTenantIdAndArtifactTypeAndExternalId(
            String tenantId, String artifactType, String externalId);
}
