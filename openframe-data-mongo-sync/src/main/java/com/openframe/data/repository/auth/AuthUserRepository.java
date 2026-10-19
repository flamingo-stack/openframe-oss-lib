package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.UserStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AuthUserRepository extends MongoRepository<AuthUser, String> {

    Optional<AuthUser> findByEmailAndStatus(String email, UserStatus status);

    /** All accounts for an email in a given status, across tenants — used to detect duplicates. */
    List<AuthUser> findAllByEmailAndStatus(String email, UserStatus status);

    Optional<AuthUser> findByEmailAndTenantIdAndStatus(String email, String tenantId, UserStatus status);

    boolean existsByEmailAndTenantId(String email, String tenantId);

    Optional<AuthUser> findByEmailAndTenantId(String email, String tenantId);
    void deleteByTenantId(String tenantId);

    /**
     * Find users that still need a CRM sync (never synced or changed since last sync).
     */
    List<AuthUser> findByCrmSyncedFalseOrCrmSyncedIsNull();
}
