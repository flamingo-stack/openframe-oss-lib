package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.RecipientType;

/**
 * Who the read-state rows belong to: the signed-in user, or the machine behind an AGENT token.
 */
public record NotificationRecipient(String id, RecipientType type) {
}
