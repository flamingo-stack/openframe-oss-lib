package com.openframe.data.cassandra.repository;

import com.openframe.data.cassandra.model.CassandraLogEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Repository;

@Repository
@ConditionalOnProperty(name = "spring.data.cassandra.enabled", havingValue = "true", matchIfMissing = false)
public interface CassandraLogEventRepository extends CassandraRepository<CassandraLogEvent, CassandraLogEvent.CassandraLogEventKey> {

}