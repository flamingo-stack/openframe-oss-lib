package com.openframe.test.data.db.collections;

import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import com.openframe.test.data.dto.invitation.Invitation;
import com.openframe.test.data.dto.invitation.InvitationStatus;

import static com.openframe.test.data.db.MongoDB.closeConnection;
import static com.openframe.test.data.db.MongoDB.getCollection;

public class InvitationsCollection {

    public static Invitation findInvitation(String email) {
        Invitation invitation = getCollection("invitations", Invitation.class).find(Filters.eq("email", email)).first();
        closeConnection();
        return invitation;
    }

    public static Invitation findInvitation(InvitationStatus status) {
        // Newest-first: on a reused tenant many invitations share a status, and the tests operate on the
        // one created earlier in the same ordered run — the oldest match is stale and 404s server-side.
        Invitation invitation = getCollection("invitations", Invitation.class)
                .find(Filters.eq("status", status))
                .sort(Sorts.descending("createdAt"))
                .first();
        closeConnection();
        return invitation;
    }

}
