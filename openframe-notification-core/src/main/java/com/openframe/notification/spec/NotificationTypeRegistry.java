package com.openframe.notification.spec;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

@Slf4j
@Component
public class NotificationTypeRegistry {

    private final Map<String, NotificationTypeSpec> byType;

    /** ObjectProvider, not List: a service with zero specs on the classpath must still boot. */
    @Autowired
    public NotificationTypeRegistry(ObjectProvider<NotificationTypeSpec> specs) {
        this(specs.orderedStream().toList());
    }

    public NotificationTypeRegistry(List<NotificationTypeSpec> specs) {
        Map<String, NotificationTypeSpec> map = new HashMap<>();
        for (NotificationTypeSpec spec : specs) {
            if (map.put(spec.type(), spec) != null) {
                throw new IllegalStateException("Duplicate notification type spec: " + spec.type());
            }
        }
        this.byType = Map.copyOf(map);
        log.info("Registered {} notification type(s): {}", byType.size(), new TreeSet<>(byType.keySet()));
    }

    public NotificationTypeSpec require(String type) {
        NotificationTypeSpec spec = byType.get(type);
        if (spec == null) {
            throw new IllegalArgumentException("Unknown notification type: " + type);
        }
        return spec;
    }
}
