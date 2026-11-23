package com.openframe.data.repository.user;

import com.openframe.data.document.user.Invitation;

import java.time.Instant;
import java.util.List;

public interface CustomInvitationRepository {

    /**
     * PENDING invitations ordered by {@code (createdAt desc, _id desc)}, starting after {@code cursor}
     * (an {@link InvitationPageCursor}); expiry is judged at {@code now}. With {@code backward} the rows
     * before the cursor are returned, nearest first; the caller reverses them for display.
     */
    List<Invitation> findOpenInvitationsPage(InvitationListFilter filter, Instant now, String cursor,
                                             boolean backward, int limit);

    long countOpenInvitations(InvitationListFilter filter, Instant now);
}
