package com.openframe.data.repository.connector;

import com.openframe.data.document.connector.ConnectorBackfill;
import com.openframe.data.document.connector.ConnectorBackfillStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConnectorBackfillRepository extends MongoRepository<ConnectorBackfill, String> {

    List<ConnectorBackfill> findByStatus(ConnectorBackfillStatus status);
}
