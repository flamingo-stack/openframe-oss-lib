package com.openframe.test.data.dto.invitation;

public enum InvitationStatus {
    PENDING,
    ACCEPTED,
    /** API only: InvitationMapper reports a stored PENDING invitation past its expiresAt as EXPIRED. */
    EXPIRED,
    REVOKED
}
