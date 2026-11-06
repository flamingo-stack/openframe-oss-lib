package com.openframe.api.dataloader;

import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;

// The recipient rides in the key because the batch runs off the request thread, where the
// security context is no longer available.
public record UnreadNotificationKey(String recipientId,
                                    RecipientType recipientType,
                                    NotificationEntityType entityType,
                                    String entityId) {
}
