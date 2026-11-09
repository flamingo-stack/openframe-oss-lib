package com.openframe.data.document.tenant;

/**
 * Status values for tenants in the authorization server.
 */
public enum TenantStatus {
    ACTIVE,
    // Blocked by Flamingo staff or the auto-block rule: its users and agents are refused until it is unblocked.
    BLOCKED,
    DELETED
}
