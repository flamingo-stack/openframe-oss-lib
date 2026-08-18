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

    private final Map<String, NotificationTypeSpec> byType;

    // ObjectProvider, not List: a service with zero specs on the classpath must still boot.
    // toUnmodifiableMap throws IllegalStateException on a duplicate type — the wanted fail-fast.
    public NotificationTypeRegistry(ObjectProvider<NotificationTypeSpec> specs) {
        this.byType = specs.stream().collect(toUnmodifiableMap(NotificationTypeSpec::type, identity()));
        TreeSet<String> sortedTypes = new TreeSet<>(byType.keySet());
        log.info("Registered {} notification type(s): {}", byType.size(), sortedTypes);
    }

    public NotificationTypeSpec require(String type) {
        NotificationTypeSpec spec = byType.get(type);
        if (spec == null) {
            throw new IllegalArgumentException("Unknown notification type: " + type);
        }
        return spec;
    }
}
