package com.openframe.test.data.dto.user;

/**
 * Mirror of {@code com.openframe.data.document.user.UserStatus}. Keep the constants in step with it:
 * this is what {@code AuthUser.status} deserializes into, so a value the server can return but this
 * enum lacks fails the entire response with a Jackson InvalidFormatException, not just that field —
 * which is how a missing SELF_DELETED broke "Create ticket" and "Reorder ticket", tests that only
 * touch users incidentally.
 */
public enum UserStatus {
    ACTIVE,
    DELETED,
    /**
     * User deleted their own account. Unlike DELETED, personal data (email, name,
     * credentials) is anonymized and the account is never reactivated; signing up
     * again with the same email creates a brand-new user.
     */
    SELF_DELETED
}
