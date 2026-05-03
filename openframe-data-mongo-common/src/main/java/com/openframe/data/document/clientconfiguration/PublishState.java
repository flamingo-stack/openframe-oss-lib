package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublishState {

    private boolean published;
    private int attempts;

    public static PublishState pending() {
        return new PublishState(false, 0);
    }

    public static PublishState nonPublished(PublishState current) {
        if (current == null || current.isPublished()) {
            return pending();
        }
        int nextAttempts = current.getAttempts() + 1;
        return new PublishState(false, nextAttempts);
    }

    public static PublishState published() {
        return new PublishState(true, 0);
    }
}
