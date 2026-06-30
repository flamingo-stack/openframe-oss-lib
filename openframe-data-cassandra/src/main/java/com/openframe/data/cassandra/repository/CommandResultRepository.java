package com.openframe.data.cassandra.repository;

import com.openframe.data.cassandra.model.CommandResult;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for {@link CommandResult} rows.
 *
 * <p>Writes that need a TTL go through {@code CassandraOperations.insert(..,
 * InsertOptions)} rather than {@link #save}; this repository is here for the
 * read side (pulling a batch by {@code execution_id}) and tests.
 */
@Repository
@ConditionalOnProperty(name = "spring.data.cassandra.enabled", havingValue = "true", matchIfMissing = false)
public interface CommandResultRepository extends CassandraRepository<CommandResult, CommandResult.CommandResultKey> {
}
