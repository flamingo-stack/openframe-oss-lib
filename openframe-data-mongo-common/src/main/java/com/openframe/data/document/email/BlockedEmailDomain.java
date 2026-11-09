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
@Document(collection = BlockedEmailDomain.COLLECTION)
public class BlockedEmailDomain {

    public static final String COLLECTION = "blocked_email_domains";

    // EmailAddressCanonicalizer.canonicalDomain form: the lookup is an exact match on this id.
    @Id
    private String domain;

    private String reason;

    private String addedBy;

    // Set by the caller: the id is assigned, so Spring Data sees every save as an update and @CreatedDate never fires.
    private Instant createdAt;
}
