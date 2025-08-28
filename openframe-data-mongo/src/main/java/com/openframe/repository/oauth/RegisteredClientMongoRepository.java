package com.openframe.repository.oauth;

import com.openframe.documents.oauth.MongoRegisteredClient;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RegisteredClientMongoRepository extends MongoRepository<MongoRegisteredClient, String> {
    Optional<MongoRegisteredClient> findByClientId(String clientId);
}
