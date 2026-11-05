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
    private String parentEventId;

    public static PublishState pending(String parentEventId) {
        return PublishState.builder().published(false).attempts(0).parentEventId(parentEventId).build();
    }

    public static PublishState nonPublished(PublishState current) {
        int previousAttempts = current == null ? 0 : current.getAttempts();
        int nextAttempts = previousAttempts + 1;
        String parentEventId = current == null ? null : current.getParentEventId();
        return PublishState.builder().published(false).attempts(nextAttempts).parentEventId(parentEventId).build();
    }

    public static PublishState published() {
        return PublishState.builder().published(true).attempts(0).build();
    }
}
