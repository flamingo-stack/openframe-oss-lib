package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.SsoIdentity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SsoIdentityRepository extends MongoRepository<SsoIdentity, String> {

    Optional<SsoIdentity> findByProviderAndSubject(String provider, String subject);

    void deleteByUserId(String userId);
}
