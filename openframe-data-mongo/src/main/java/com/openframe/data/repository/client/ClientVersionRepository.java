package com.openframe.data.repository.client;

import com.openframe.data.document.client.ClientVersion;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ClientVersionRepository extends MongoRepository<ClientVersion, String> {
	Optional<ClientVersion> findTopByOrderByCreatedAtDesc();
}


