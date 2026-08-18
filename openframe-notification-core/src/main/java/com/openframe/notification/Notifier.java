package com.openframe.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationText;
import com.openframe.notification.spec.NotificationTypeRegistry;
import com.openframe.notification.spec.NotificationTypeSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class Notifier {

    private final NotificationTypeRegistry registry;
    private final NotificationBroadcaster broadcaster;

    public void notify(String type, Map<String, String> seed) {
        notify(type, seed, null);
    }

    public void notify(String type, Map<String, String> seed, String correlationId) {
        NotificationTypeSpec spec = registry.require(type);
        Attrs seeded = Attrs.seed(spec, seed);
        Attrs attrs = spec.enrich(seeded);

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
        NotificationText text = spec.compose(attrs);
        String title = text.getTitle();
        String description = text.getDescription();
        Set<String> users = audience.users();
        Set<String> machines = audience.machines();
        Map<String, String> attributes = attrs.asMap();
        NotificationSeverity severity = spec.getSeverity();
        NotificationContext legacyContext = spec.buildLegacyContext(attrs);
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
}
