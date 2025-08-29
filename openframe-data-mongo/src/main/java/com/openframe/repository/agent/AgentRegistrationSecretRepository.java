package com.openframe.repository.agent;

import com.openframe.document.agent.AgentRegistrationSecret;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AgentRegistrationSecretRepository extends MongoRepository<AgentRegistrationSecret, String> {

    Optional<AgentRegistrationSecret> findByActiveTrue();

    @Query(value = "{}", exists = true)
    boolean existsAny();

}