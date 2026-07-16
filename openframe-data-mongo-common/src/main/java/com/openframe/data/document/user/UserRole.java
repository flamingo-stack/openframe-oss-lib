package com.openframe.data.document.user;

import java.util.Collection;
import java.util.LinkedHashSet;
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
        Set<UserRole> effective = new LinkedHashSet<>();
        if (granted != null) {
            effective.addAll(granted);
        }
        if (effective.contains(OWNER)) {
            effective.add(ADMIN);
        }
        return effective;
    }
}
