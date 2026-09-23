package com.openframe.test.data.dto.user;

/**
 * Mirror of {@code com.openframe.data.document.user.UserStatus}. Keep the constants in step with it:
 * this is what {@code AuthUser.status} deserializes into, so a value the server can return but this
 * enum lacks fails the entire response with a Jackson InvalidFormatException, not just that field —
 * which is how a missing SELF_DELETED broke "Create ticket" and "Reorder ticket", tests that only
 * touch users incidentally.
 *
 * <p>Because nothing in the build enforces this mirror relationship, any addition to the
 * server-side enum must be manually mirrored here. A contract test asserting parity between
 * this enum and {@code com.openframe.data.document.user.UserStatus} should be added in the
 * module that has visibility of both enums (this module does not depend on the server module,
 * so such a test cannot live here without introducing that dependency).
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
