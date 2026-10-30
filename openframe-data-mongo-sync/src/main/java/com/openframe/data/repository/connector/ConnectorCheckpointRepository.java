package com.openframe.data.repository.connector;

import com.openframe.data.document.connector.ConnectorCheckpoint;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConnectorCheckpointRepository extends MongoRepository<ConnectorCheckpoint, String> {
}
