package com.openframe.data.document.email;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@Document(collection = BlockedEmailAddress.COLLECTION)
public class BlockedEmailAddress extends BlockedEmailEntry {

    public static final String COLLECTION = "blocked_email_addresses";

    // Stored in the EmailAddressCanonicalizer.canonicalAddress form: the lookup is an exact match on this id.
    @Id
    private String email;
}
