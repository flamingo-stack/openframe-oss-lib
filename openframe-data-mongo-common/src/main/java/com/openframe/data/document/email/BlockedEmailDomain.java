package com.openframe.data.document.email;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * An email domain that may not register, be invited, or be configured for SSO auto-provisioning, kept in the
 * database so it can be added and removed without a deploy. The configured
 * {@code openframe.email-domain-policy.blocked-domains} list still applies alongside it. Empty unless someone
 * adds entries, so a deployment that never uses it behaves exactly as before.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@Document(collection = BlockedEmailDomain.COLLECTION)
public class BlockedEmailDomain extends BlockedEmailEntry {

    public static final String COLLECTION = "blocked_email_domains";

    /**
     * The domain itself, in the {@code EmailDomainPolicy.normalizeDomain} form: trimmed and lowercase, no local
     * part. The lookup is an exact match on this id, so an entry inserted by hand as {@code Rogue.Example} or with
     * spaces never matches. Keeping it the id also means the collection cannot hold a domain twice.
     */
    @Id
    private String domain;
}
