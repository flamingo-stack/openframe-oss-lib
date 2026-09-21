package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AppleUserToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppleUserTokenRepository extends MongoRepository<AppleUserToken, String> {

    Optional<AppleUserToken> findByUserId(String userId);

    void deleteByUserId(String userId);
}
