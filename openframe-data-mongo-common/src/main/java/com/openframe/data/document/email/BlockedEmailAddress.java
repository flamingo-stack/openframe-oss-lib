package com.openframe.data.document.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One email address that may not register, be invited, or pass the website's form gate, kept in the database
 * so it can be added and removed without a deploy. It blocks that address only, never the rest of its domain,
 * and the configured {@code allowed-domains} carve-out does not lift it. Empty unless someone adds entries, so
 * a deployment that never uses it behaves exactly as before.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = BlockedEmailAddress.COLLECTION)
public class BlockedEmailAddress {

    public static final String COLLECTION = "blocked_email_addresses";

    /**
     * The address itself, in the {@code EmailDomainPolicy.normalizeEmail} form: trimmed and lowercase, a
     * {@code +tag} kept as written. The lookup is an exact match on this id, so an entry inserted by hand as
     * {@code Someone@Example.com} never matches, and the collection cannot hold an address twice.
     */
    @Id
    private String email;

    /** Why it is blocked: the submission or incident it came from. */
    private String reason;

    /** Who added it. */
    private String addedBy;

    @CreatedDate
    private Instant createdAt;
}
