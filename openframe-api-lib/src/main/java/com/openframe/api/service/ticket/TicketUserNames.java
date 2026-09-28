package com.openframe.api.service.ticket;

import com.openframe.data.document.user.User;

/** Display-name convention for users denormalized onto tickets (assignee, resolver). */
public final class TicketUserNames {

    private TicketUserNames() {
    }

    /** "First Last", falling back to the email when both names are blank. */
    public static String displayName(User user) {
        String firstName = user.getFirstName() != null ? user.getFirstName() : "";
        String lastName = user.getLastName() != null ? user.getLastName() : "";
        String displayName = (firstName + " " + lastName).trim();
        return displayName.isEmpty() ? user.getEmail() : displayName;
    }

    /** "First Last" or null when both are blank (no email fallback). */
    public static String profileName(User user) {
        String firstName = user.getFirstName() != null ? user.getFirstName() : "";
        String lastName = user.getLastName() != null ? user.getLastName() : "";
        String name = (firstName + " " + lastName).trim();
        return name.isEmpty() ? null : name;
    }
}
