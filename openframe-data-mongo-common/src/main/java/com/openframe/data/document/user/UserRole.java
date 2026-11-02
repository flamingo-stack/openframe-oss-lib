package com.openframe.data.document.user;

import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public enum UserRole {
    ADMIN,
    OWNER;

    /**
     * Adds ADMIN when the user is an OWNER.
     *
     * <p>Mongo stores only what was granted, so an owner is saved as just OWNER.
     */
    public static Set<UserRole> effective(Collection<UserRole> granted) {
        var effective = granted == null
                ? new LinkedHashSet<UserRole>()
                : new LinkedHashSet<>(granted);
        if (effective.contains(OWNER)) {
            effective.add(ADMIN);
        }
        return effective;
    }

    /**
     * The granted roles that make a user any of {@code wanted}, i.e. what a filter on effective roles asks
     * Mongo for: ADMIN matches the owners too. Empty for none.
     */
    public static Set<UserRole> grantedFor(Collection<UserRole> wanted) {
        Set<UserRole> granted = EnumSet.noneOf(UserRole.class);
        if (wanted == null) {
            return granted;
        }
        for (UserRole role : values()) {
            if (!Collections.disjoint(effective(List.of(role)), wanted)) {
                granted.add(role);
            }
        }
        return granted;
    }
}
