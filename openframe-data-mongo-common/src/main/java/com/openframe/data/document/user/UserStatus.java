package com.openframe.data.document.user;

/**
 * Status values for authorization server users.
 */
public enum UserStatus {
    ACTIVE,
    DELETED,
    /**
     * User deleted their own account. Unlike DELETED, personal data (email, name,
     * credentials) is anonymized and the account is never reactivated; signing up
     * again with the same email creates a brand-new user.
     */
    SELF_DELETED,
    /**
     * Terminal state after an admin permanently removes an already-deleted user.
     * Personal data is anonymized and the user is excluded from all user lists;
     * the document is kept only so historical references by id stay resolvable.
     */
    REMOVED
}
