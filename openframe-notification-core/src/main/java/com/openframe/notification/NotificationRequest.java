package com.openframe.notification;

import com.openframe.notification.spec.AttrKey;
import com.openframe.notification.spec.NotificationType;
import lombok.Getter;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Getter
public final class NotificationRequest {

    private final NotificationType type;
    private final Map<String, String> attrs;

    private NotificationRequest(NotificationType type, Map<String, String> attrs) {
        this.type = type;
        this.attrs = attrs;
    }

    public static Builder of(NotificationType type) {
        Objects.requireNonNull(type, "type must not be null");
        return new Builder(type);
    }

    public static final class Builder {

        private final NotificationType type;
        private final Map<String, String> attrs = new LinkedHashMap<>();

        private Builder(NotificationType type) {
            this.type = type;
        }

        // Null/blank leaves the attribute absent — an optional fact simply isn't there.
        public Builder attr(AttrKey key, String value) {
            if (!isBlank(value)) {
                attrs.put(key.getName(), value);
            }
            return this;
        }

        public NotificationRequest build() {
            return new NotificationRequest(type, Map.copyOf(attrs));
        }
    }
}
