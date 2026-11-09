package com.openframe.core.email;

// Implementations fail open: a source that cannot answer returns false, so a datastore problem never blocks a signup.
public interface BlockedEmailAddressSource {

    boolean isBlocked(String canonicalAddress);
}
