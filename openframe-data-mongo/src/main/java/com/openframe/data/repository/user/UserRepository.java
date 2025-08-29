package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public interface UserRepository extends MongoRepository<User, String>, BaseUserRepository<Optional<User>, Boolean, String> {
    @Override
    Optional<User> findByEmail(String email);

    @Override
    Boolean existsByEmail(String email);
} 