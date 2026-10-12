package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;

import java.time.Instant;
import java.util.List;

public interface CustomInvitationRepository {

    /**
     * PENDING invitations ordered by {@code (createdAt desc, _id desc)}, starting after {@code cursor}
     * (an {@link InvitationPageCursor}). {@code expired}: {@code true} keeps those past {@code expiresAt}
     * at {@code now}, {@code false} those not yet past it, {@code null} both. {@code search} matches the email.
     */
    List<Invitation> findOpenInvitationsPage(Boolean expired, Instant now, String search, String cursor, int limit);

    long countOpenInvitations(Boolean expired, Instant now, String search);
}
