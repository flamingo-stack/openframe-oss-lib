package com.openframe.data.repository.delivery;

import com.openframe.data.document.delivery.ProcessedCommand;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;

@TenantAwareRepository
public interface ProcessedCommandRepository extends MongoRepository<ProcessedCommand, String> {
}
