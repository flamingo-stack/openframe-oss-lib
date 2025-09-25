package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AuthUserRepository extends MongoRepository<AuthUser, String> {

    /**
     * Find single ACTIVE user by email
     */
    Optional<AuthUser> findByEmailAndStatus(String email, UserStatus status);

    /**
     * Find single ACTIVE user by email within a specific tenant
     */
    Optional<AuthUser> findByEmailAndTenantIdAndStatus(String email, String tenantId, UserStatus status);

    boolean existsByEmailAndTenantId(String email, String tenantId);

    /**
     * Find single user by email within a specific tenant regardless of status
     */
    Optional<AuthUser> findByEmailAndTenantId(String email, String tenantId);
}