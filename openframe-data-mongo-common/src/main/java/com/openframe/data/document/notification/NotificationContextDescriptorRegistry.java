package com.openframe.data.document.notification;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class NotificationContextDescriptorRegistry {

    private final Map<String, NotificationContextDescriptor> byType;

    public NotificationContextDescriptorRegistry(List<NotificationContextDescriptor> descriptors) {
        Map<String, NotificationContextDescriptor> map = new HashMap<>(descriptors.size());
        for (NotificationContextDescriptor descriptor : descriptors) {
            map.put(descriptor.type(), descriptor);
        }
        this.byType = Map.copyOf(map);
    }

    public NotificationCategory categoryOf(String type) {
        NotificationContextDescriptor descriptor = byType.get(type);
        return descriptor == null ? NotificationCategory.GENERIC : descriptor.category();
    }
}
