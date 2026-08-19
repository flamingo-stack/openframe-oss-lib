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

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationEmitter {

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

            Audience declared = spec.audience(attrs);
            NotificationCommand command = buildCommand(correlationId, spec, attrs, declared);
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

        Map<String, String> attributes = attrs.asMap();
        NotificationSeverity severity = spec.getSeverity();
        NotificationContext legacyContext = spec.buildLegacyContext(attrs);
        NotificationType specType = spec.getType();
        return NotificationCommand.builder()
                .type(specType)
                .attributes(attributes)
                .title(title)
                .description(description)
                .severity(severity)
                .context(legacyContext)
                .correlationId(correlationId)
                .audience(audience)
                .build();
    }
}
