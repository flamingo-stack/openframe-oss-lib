package com.openframe.notification.spec;

import com.openframe.data.document.notification.NotificationEntityType;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
@AllArgsConstructor
public class NotificationEntityRef {

    private final NotificationEntityType type;
    private final String id;

    // Empty, never an exception: the emitter swallows what a spec throws, so a blank id here would
    // cost the whole notification instead of just its badge.
    public static Optional<NotificationEntityRef> ticket(String ticketId) {
        return of(NotificationEntityType.TICKET, ticketId);
    }

    public static Optional<NotificationEntityRef> dialog(String dialogId) {
        return of(NotificationEntityType.DIALOG, dialogId);
    }

    private static Optional<NotificationEntityRef> of(NotificationEntityType type, String id) {
        if (isBlank(id)) {
            return Optional.empty();
        }
        NotificationEntityRef ref = new NotificationEntityRef(type, id);
        return Optional.of(ref);
    }
}
