package com.openframe.data.repository.user;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AuthUserRepository extends MongoRepository<AuthUser, String> {

    /**
     * Find all ACTIVE users by email across tenants
     * Prefer this over findAllByEmail + in-memory filtering
     */
    List<AuthUser> findAllByEmailAndStatus(String email, UserStatus status);

    /**
     * Find single ACTIVE user by email
     */
    Optional<AuthUser> findByEmailAndStatus(String email, UserStatus status);

    /**
     * Find single ACTIVE user by email within a specific tenant
     */
    Optional<AuthUser> findByEmailAndTenantIdAndStatus(String email, String tenantId, UserStatus status);

    boolean existsByEmailAndTenantId(String email, String tenantId);
}