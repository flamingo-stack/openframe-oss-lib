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
        return PublishState.builder().published(false).attempts(0).build();
    }

    public static PublishState nonPublished(PublishState current) {
        int previousAttempts = current == null ? 0 : current.getAttempts();
        int nextAttempts = previousAttempts + 1;
        return PublishState.builder().published(false).attempts(nextAttempts).build();
    }

    public static PublishState published() {
        return PublishState.builder().published(true).attempts(0).build();
    }
}
