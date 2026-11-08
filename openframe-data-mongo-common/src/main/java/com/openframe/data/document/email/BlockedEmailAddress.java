package com.openframe.data.document.email;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One email address that may not register, be invited, or pass the website's form gate, kept in the database
 * so it can be added and removed without a deploy. It blocks that address only, never the rest of its domain,
 * and the configured {@code allowed-domains} carve-out does not lift it. Empty unless someone adds entries, so
 * a deployment that never uses it behaves exactly as before.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@Document(collection = BlockedEmailAddress.COLLECTION)
public class BlockedEmailAddress extends BlockedEmailEntry {

    public static final String COLLECTION = "blocked_email_addresses";

    /**
     * The address itself, in the {@code EmailDomainPolicy.normalizeEmail} form: trimmed and lowercase, no
     * {@code +tag}, and on Gmail no dots in the local part, so one entry blocks every spelling of the mailbox. The lookup is an exact match on this id, so an entry inserted by hand as
     * {@code Someone@Example.com} never matches, and the collection cannot hold an address twice.
     */
    @Id
    private String email;
}
