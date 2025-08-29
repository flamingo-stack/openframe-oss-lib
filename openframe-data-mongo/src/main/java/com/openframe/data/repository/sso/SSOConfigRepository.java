package com.openframe.data.repository.sso;

import com.openframe.data.document.sso.SSOConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SSOConfigRepository extends MongoRepository<SSOConfig, String> {

    Optional<SSOConfig> findByProvider(String provider);

    List<SSOConfig> findByEnabledTrue();
}