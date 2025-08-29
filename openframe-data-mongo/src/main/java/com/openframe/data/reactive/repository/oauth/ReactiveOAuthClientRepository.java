package com.openframe.data.reactive.repository.oauth;

import com.openframe.data.document.oauth.OAuthClient;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface ReactiveOAuthClientRepository extends ReactiveMongoRepository<OAuthClient, String> {

    Mono<OAuthClient> findByClientId(String clientId);

}
