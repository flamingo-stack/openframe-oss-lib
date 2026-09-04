package com.openframe.data.document.auth;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Federated identity link: binds a provider's STABLE subject to an OpenFrame user, so returning
 * logins resolve by an identifier the provider stands behind unconditionally instead of by the
 * email claim (which, for a generic multi-tenant Microsoft app, is admin-typed free text — the
 * nOAuth takeover class). The first association still requires a trusted event (verified-email
 * match, invitation, or an authenticated session); after that the link is authoritative.
 * <p>
 * <b>Invariant (product decision): one SSO account belongs to exactly ONE user, platform-wide.</b>
 * The {@code (provider, subject)} unique index is global on purpose — an email may exist in
 * several tenants, a provider subject may not. Registration paths enforce this up front
 * (an already-linked subject cannot create another account); the conflict guard in
 * {@code SsoIdentityService.link} is the last-resort backstop, not the enforcement point.
 * <p>
 * Subject normalization: Microsoft uses {@code tid:oid} (the pairwise {@code sub} changes when
 * the app registration is rotated); Google and Apple use {@code sub} as issued.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sso_identities")
@CompoundIndex(def = "{'provider': 1, 'subject': 1}", unique = true)
public class SsoIdentity implements TenantScoped {

    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed
    private String userId;
    private String provider;
    private String subject;
    private Instant createdAt;
    private Instant lastSeenAt;
}
