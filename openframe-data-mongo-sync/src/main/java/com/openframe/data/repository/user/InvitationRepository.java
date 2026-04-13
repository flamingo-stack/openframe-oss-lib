package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface InvitationRepository extends MongoRepository<Invitation, String> {
    Optional<Invitation> findByEmailAndStatus(String email, String status);

    Page<Invitation> findByStatusNotIn(Collection<InvitationStatus> statuses, Pageable pageable);
}