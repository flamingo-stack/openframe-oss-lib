package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.Notification;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Delegate;

/**
 * Service-layer projection of a {@link Notification} with the per-user read flag
 * overlaid. Keeps the persistence entity free of view-only state — the {@code @Delegate}
 * exposes the entity's getters so DGS still resolves GraphQL fields by reflection
 * against this wrapper.
 */
@Getter
@RequiredArgsConstructor
public class NotificationView {

    @Delegate
    private final Notification notification;

    private final boolean read;
}
