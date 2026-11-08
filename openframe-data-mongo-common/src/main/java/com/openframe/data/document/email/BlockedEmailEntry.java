package com.openframe.data.document.email;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.CreatedDate;

import java.time.Instant;

/**
 * What every blocklist entry records beside the value it blocks (its id): why, who decided, and when. Shared by
 * {@link BlockedEmailDomain} and {@link BlockedEmailAddress}, which keep their own collection and id.
 */
@Data
@SuperBuilder
@NoArgsConstructor
public abstract class BlockedEmailEntry {

    /** Why it is blocked: the signup, submission or incident it came from. */
    private String reason;

    /** Who added it. */
    private String addedBy;

    @CreatedDate
    private Instant createdAt;
}
