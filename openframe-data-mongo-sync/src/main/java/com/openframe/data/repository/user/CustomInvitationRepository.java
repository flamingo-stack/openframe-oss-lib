package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;

import java.time.Instant;
import java.util.List;

public interface CustomInvitationRepository {

    /**
     * PENDING invitations ordered by {@code (createdAt desc, _id desc)}, starting after {@code cursor}
     * (an {@link InvitationPageCursor}); expiry is judged at {@code now}.
     */
    List<Invitation> findOpenInvitationsPage(InvitationListFilter filter, Instant now, String cursor, int limit);

    long countOpenInvitations(InvitationListFilter filter, Instant now);
}
