package com.openframe.data.repository.connector;

import com.openframe.data.document.connector.ConnectorRecreationEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public interface ConnectorRecreationEventRepository extends MongoRepository<ConnectorRecreationEvent, String> {

    long countByBaseNameAndCreatedAtAfter(String baseName, Instant cutoff);

    long deleteByCreatedAtBefore(Instant cutoff);
}
