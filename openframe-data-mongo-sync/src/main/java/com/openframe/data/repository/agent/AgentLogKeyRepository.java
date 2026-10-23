package com.openframe.data.repository.agent;

import com.openframe.data.document.agent.AgentLogKey;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgentLogKeyRepository extends MongoRepository<AgentLogKey, String> {

    Optional<AgentLogKey> findFirstByOrderByCreatedAtDesc();

    @Query(value = "{}", exists = true)
    boolean existsAny();

}
