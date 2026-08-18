package com.openframe.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationText;
import com.openframe.notification.spec.NotificationType;
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

    public void notify(NotificationRequest request) {
        notify(request, null);
    }

    // Never throws: a notification bug must not fail the business flow that emitted it.
    public void notify(NotificationRequest request, String correlationId) {
        NotificationType type = request.getType();
        try {
            NotificationTypeSpec spec = registry.require(type);
            Attrs attrs = Attrs.validated(spec, request.getAttrs());

            Audience audience = spec.audience(attrs);
            if (audience.isEmpty()) {
                log.debug("{}: audience is empty — nothing to notify", type.name());
                return;
            }

            NotificationCommand command = buildCommand(correlationId, spec, attrs, audience);
            broadcaster.broadcast(command);
        } catch (RuntimeException ex) {
            log.error("Notification emission failed for type {} — swallowed, business flow unaffected",
                    type.name(), ex);
        }
    }

    private static NotificationCommand buildCommand(String correlationId,
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
        String typeName = spec.getType().name();
        return NotificationCommand.builder()
                .type(typeName)
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
