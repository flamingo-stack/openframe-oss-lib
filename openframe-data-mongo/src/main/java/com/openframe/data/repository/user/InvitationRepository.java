package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvitationRepository extends MongoRepository<Invitation, String> {
    Optional<Invitation> findByEmailAndStatus(String email, String status);
    List<Invitation> findByEmailOrderByCreatedAtDesc(String email);
    void deleteByExpiresAtBefore(Instant cutoff);
}