package com.openframe.data.document.email;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

@Data
@SuperBuilder
@NoArgsConstructor
public abstract class BlockedEmailEntry {

    private String reason;
    private String addedBy;
    private Instant createdAt;
}
