package com.openframe.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
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
import java.util.Set;

// Throws only on programmer errors (unknown type, broken seed) — producers keep their existing
// catch-and-log so a notification bug never fails the business flow.
@Slf4j
@Service
@RequiredArgsConstructor
public class Notifier {

    // One oversized value would ride to every recipient in every NATS payload.
    private static final int MAX_ATTRIBUTE_VALUE_BYTES = 8 * 1024;

    private final NotificationTypeRegistry registry;
    private final NotificationBroadcaster broadcaster;

    public void notify(String type, Map<String, String> seed) {
        notify(type, seed, null);
    }

    public void notify(String type, Map<String, String> seed, String correlationId) {
        NotificationTypeSpec spec = registry.require(type);
        Attrs seeded = Attrs.seed(spec, seed);
        Attrs attrs = spec.enrich(seeded);
        rejectOversizedAttributes(type, attrs);

        Audience audience = spec.audience(attrs);
        if (audience.isEmpty()) {
            log.debug("{}: audience is empty — nothing to notify", type);
            return;
        }

        NotificationCommand command = buildCommand(type, correlationId, spec, attrs, audience);
        broadcaster.broadcast(command);
    }

    private static NotificationCommand buildCommand(String type,
                                                    String correlationId,
                                                    NotificationTypeSpec spec,
                                                    Attrs attrs,
                                                    Audience audience) {
        Composed text = spec.compose(attrs);
        String title = text.getTitle();
        String description = text.getDescription();
        Set<String> users = audience.users();
        Set<String> machines = audience.machines();
        Map<String, String> attributes = attrs.asMap();
        NotificationSeverity severity = spec.severity(attrs);
        NotificationContext legacyContext = spec.legacyContext(attrs);
        return NotificationCommand.builder()
                .type(type)
                .attributes(attributes)
                .title(title)
                .description(description)
                .severity(severity)
                .context(legacyContext)
                .correlationId(correlationId)
                .adminAudience(users)
                .machineAudience(machines)
                .build();
    }

    private static void rejectOversizedAttributes(String type, Attrs attrs) {
        for (Map.Entry<String, String> entry : attrs.asMap().entrySet()) {
            String value = entry.getValue();
            int size = value.getBytes(StandardCharsets.UTF_8).length;
            if (size > MAX_ATTRIBUTE_VALUE_BYTES) {
                String key = entry.getKey();
                throw new IllegalArgumentException(
                        type + ": attribute '" + key + "' exceeds " + MAX_ATTRIBUTE_VALUE_BYTES + " bytes");
            }
        }
    }
}
