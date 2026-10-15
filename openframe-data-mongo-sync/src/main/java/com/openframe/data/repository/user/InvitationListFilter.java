package com.openframe.data.repository.user;

import com.openframe.data.document.user.UserRole;

import java.util.Collection;

/**
 * What {@link CustomInvitationRepository#findOpenInvitationsPage} and
 * {@link CustomInvitationRepository#countOpenInvitations} narrow the open invitations by; a null or empty part
 * narrows by nothing.
 *
 * @param expired {@code true} keeps those past {@code expiresAt}, {@code false} those not yet past it
 * @param roles   granted roles, as stored
 * @param search  matches the email
 */
public record InvitationListFilter(Boolean expired, Collection<UserRole> roles, String search) {

    public InvitationListFilter withExpired(Boolean expired) {
        return new InvitationListFilter(expired, roles, search);
    }

    public InvitationListFilter withRoles(Collection<UserRole> roles) {
        return new InvitationListFilter(expired, roles, search);
    }
}
