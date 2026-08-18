package com.openframe.notification.spec;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.TreeSet;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

@Slf4j
@Component
public class NotificationTypeRegistry {

    private final Map<String, NotificationTypeSpec> byTypeName;

    // ObjectProvider, not List: a service with zero specs on the classpath must still boot.
    // toUnmodifiableMap throws IllegalStateException on a duplicate type — the wanted fail-fast.
    public NotificationTypeRegistry(ObjectProvider<NotificationTypeSpec> specs) {
        this.byTypeName = specs.stream()
                .collect(toUnmodifiableMap(spec -> spec.getType().name(), identity()));
        TreeSet<String> sortedTypes = new TreeSet<>(byTypeName.keySet());
        log.info("Registered {} notification type(s): {}", byTypeName.size(), sortedTypes);
    }

    public NotificationTypeSpec require(NotificationType type) {
        NotificationTypeSpec spec = byTypeName.get(type.name());
        if (spec == null) {
            throw new IllegalArgumentException("No spec registered for notification type: " + type.name());
        }
        return spec;
    }
}
