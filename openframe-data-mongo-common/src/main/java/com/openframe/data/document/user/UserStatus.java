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
    SELF_DELETED
}
