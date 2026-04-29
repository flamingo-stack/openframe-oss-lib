package com.openframe.data.document.auth;

import com.openframe.data.document.user.Invitation;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
// Compound index (tenantId, email) speeds up "lookup invitations for X in tenant Y" queries.
// Not unique: a tenant can legitimately have multiple invitations for the same email
// (e.g., re-invite after expiry, separate role-specific invites).
@CompoundIndex(def = "{'tenantId': 1, 'email': 1}")
public class AuthInvitation extends Invitation {
}