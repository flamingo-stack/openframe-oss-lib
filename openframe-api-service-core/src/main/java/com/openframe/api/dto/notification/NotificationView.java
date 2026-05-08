package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.Notification;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.experimental.Delegate;

@Getter
@RequiredArgsConstructor
public class NotificationView {

    @Delegate
    private final Notification notification;

    private final boolean read;
}
