package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationEntityType;
import lombok.AllArgsConstructor;
import lombok.Getter;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
@AllArgsConstructor
public class EntityRef {

    private final NotificationEntityType type;
    private final String id;

    public static EntityRef ticket(String ticketId) {
        return of(NotificationEntityType.TICKET, ticketId);
    }

    public static EntityRef dialog(String dialogId) {
        return of(NotificationEntityType.DIALOG, dialogId);
    }

    private static EntityRef of(NotificationEntityType type, String id) {
        if (isBlank(id)) {
            throw new IllegalArgumentException("entity id must not be blank for type " + type);
        }
        return new EntityRef(type, id);
    }
}
