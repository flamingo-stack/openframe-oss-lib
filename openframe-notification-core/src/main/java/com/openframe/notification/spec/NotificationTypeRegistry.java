package com.openframe.notification.spec;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;

@Slf4j
@Component
public class NotificationTypeRegistry {

    private final Map<String, NotificationTypeSpec> byType;

    // ObjectProvider, not List: a service with zero specs on the classpath must still boot.
    public NotificationTypeRegistry(ObjectProvider<NotificationTypeSpec> specs) {
        Map<String, NotificationTypeSpec> map = new HashMap<>();
        specs.stream().forEach(spec -> register(map, spec));
        this.byType = Map.copyOf(map);
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

    private static void register(Map<String, NotificationTypeSpec> map, NotificationTypeSpec spec) {
        String type = spec.type();
        NotificationTypeSpec previous = map.put(type, spec);
        if (previous != null) {
            throw new IllegalStateException("Duplicate notification type spec: " + type);
        }
    }
}
