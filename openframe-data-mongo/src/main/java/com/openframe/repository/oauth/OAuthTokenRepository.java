package com.openframe.repository.oauth;

import com.openframe.document.oauth.OAuthToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OAuthTokenRepository extends MongoRepository<OAuthToken, String> {
    Optional<OAuthToken> findByAccessToken(String accessToken);

    Optional<OAuthToken> findByRefreshToken(String refreshToken);
} 