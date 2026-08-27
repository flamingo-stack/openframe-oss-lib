package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationEntityType;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
@AllArgsConstructor
public class NotificationEntityRef {

    private final NotificationEntityType type;
    private final String id;

    public static NotificationEntityRef ticket(String ticketId) {
        return of(NotificationEntityType.TICKET, ticketId);
    }

    public static NotificationEntityRef dialog(String dialogId) {
        return of(NotificationEntityType.DIALOG, dialogId);
    }

    private static NotificationEntityRef of(NotificationEntityType type, String id) {
        if (isBlank(id)) {
            throw new IllegalArgumentException("entity id must not be blank for type " + type);
        }
        return new NotificationEntityRef(type, id);
    }
}
