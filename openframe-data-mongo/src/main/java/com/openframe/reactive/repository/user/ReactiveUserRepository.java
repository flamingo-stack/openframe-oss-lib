package com.openframe.reactive.repository.user;

import com.openframe.document.user.User;
import com.openframe.repository.user.BaseUserRepository;
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

    @Override
    Mono<User> findByResetToken(String resetToken);
} 