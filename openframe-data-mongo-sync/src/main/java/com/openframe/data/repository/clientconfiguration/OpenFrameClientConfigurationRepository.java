package com.openframe.data.repository.clientconfiguration;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OpenFrameClientConfigurationRepository extends MongoRepository<OpenFrameClientConfiguration, String> {

    Optional<OpenFrameClientConfiguration> findFirstByOrderByCreatedAtDesc();

}
