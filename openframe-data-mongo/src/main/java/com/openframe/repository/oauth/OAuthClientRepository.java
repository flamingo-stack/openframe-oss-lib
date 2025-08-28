package com.openframe.repository.oauth;

import com.openframe.documents.oauth.OAuthClient;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OAuthClientRepository extends MongoRepository<OAuthClient, String> {
    Optional<OAuthClient> findByClientId(String clientId);

    boolean existsByMachineId(String machineId);
} 