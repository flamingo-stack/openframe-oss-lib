package com.openframe.data.repository.auth;

import com.openframe.data.document.auth.AuthInvitation;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AuthInvitationRepository extends MongoRepository<AuthInvitation, String> {
    Optional<AuthInvitation> findByTenantIdAndId(String tenantId, String id);
    Optional<AuthInvitation> findByTenantIdAndEmailAndStatus(String tenantId, String email, String status);
    List<AuthInvitation> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, String status);
    void deleteByTenantIdAndExpiresAtBefore(String tenantId, Instant cutoff);
}