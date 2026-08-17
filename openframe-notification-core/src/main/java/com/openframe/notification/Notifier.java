package com.openframe.notification;

import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.Composed;
import com.openframe.notification.spec.NotificationTypeRegistry;
import com.openframe.notification.spec.NotificationTypeSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * The emission entry point: a producer reports {type + seed facts}, the type's spec turns that
 * into a notification. Throws only on programmer errors (unknown type, broken seed) — producers
 * keep their existing catch-and-log so a notification bug never fails the business flow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Notifier {

    /** One oversized value would ride to every recipient in every NATS payload. */
    private static final int MAX_ATTRIBUTE_VALUE_BYTES = 8 * 1024;

    private final NotificationTypeRegistry registry;
    private final NotificationBroadcaster broadcaster;

    public void notify(String type, Map<String, String> seed) {
        notify(type, seed, null);
    }

    public void notify(String type, Map<String, String> seed, String correlationId) {
        NotificationTypeSpec spec = registry.require(type);
        Attrs attrs = spec.enrich(Attrs.seed(spec, seed));
        capCheck(type, attrs);

        Audience audience = spec.audience(attrs);
        if (audience.isEmpty()) {
            log.debug("{}: audience is empty — nothing to notify", type);
            return;
        }

        Composed text = spec.compose(attrs);
        broadcaster.broadcast(NotificationCommand.builder()
                .type(type)
                .attributes(attrs.asMap())
                .title(text.title())
                .description(text.description())
                .severity(spec.severity(attrs))
                .context(spec.legacyContext(attrs))
                .correlationId(correlationId)
                .adminAudience(audience.users())
                .machineAudience(audience.machines())
                .build());
    }

    private static void capCheck(String type, Attrs attrs) {
        for (Map.Entry<String, String> entry : attrs.asMap().entrySet()) {
            if (entry.getValue().getBytes(StandardCharsets.UTF_8).length > MAX_ATTRIBUTE_VALUE_BYTES) {
                throw new IllegalArgumentException(
                        type + ": attribute '" + entry.getKey() + "' exceeds " + MAX_ATTRIBUTE_VALUE_BYTES + " bytes");
            }
        }
    }
}
