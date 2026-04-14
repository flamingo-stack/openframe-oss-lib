package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishState {

    private boolean published;
    private Instant publishedAt;
    private int attempts;

    public static PublishState nonPublished(PublishState current) {
        if (current == null || current.isPublished()) {
            return new PublishState(false, null, 0);
        }

        int nextAttempts = current.getAttempts() + 1;
        Instant publishedAt = current.getPublishedAt();
        return new PublishState(false, publishedAt, nextAttempts);
    }

    public static PublishState published(PublishState current) {
        int attempts = current == null ? 0 : current.getAttempts();
        return new PublishState(true, Instant.now(), attempts);
    }
}
