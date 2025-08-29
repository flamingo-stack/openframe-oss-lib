package com.openframe.data.reactive.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.repository.user.BaseUserRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.REACTIVE)
public interface ReactiveUserRepository extends ReactiveMongoRepository<User, String>, BaseUserRepository<Mono<User>, Mono<Boolean>, String> {
    @Override
    Mono<User> findByEmail(String email);

    @Override
    Mono<Boolean> existsByEmail(String email);
} 