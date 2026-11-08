package com.openframe.data.document.email;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = BlockedEmailAddress.COLLECTION)
public class BlockedEmailAddress {

    public static final String COLLECTION = "blocked_email_addresses";

    // EmailAddressCanonicalizer.canonicalAddress form: the lookup is an exact match on this id.
    @Id
    private String email;

    private String reason;

    private String addedBy;

    // Set by the caller: the id is assigned, so Spring Data sees every save as an update and @CreatedDate never fires.
    private Instant createdAt;
}
