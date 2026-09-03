package com.openframe.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationEntityRef;
import com.openframe.notification.spec.NotificationSeed;
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
        NotificationSeed seed = request.getSeed();
        NotificationType type = seed.type();
        try {
            NotificationTypeSpec<?> spec = registry.require(type);
            NotificationCommand command = buildCommand(spec, seed, correlationId);
            broadcaster.broadcast(command);
        } catch (RuntimeException ex) {
            log.error("Notification emission failed for type {} — swallowed, business flow unaffected",
                    type.name(), ex);
        }
    }

    // The cast is the wiring check: a seed whose type() routes to a spec built for another
    // seed class fails loudly here, not with a mystery deep inside the spec.
    private static <S extends NotificationSeed> NotificationCommand buildCommand(NotificationTypeSpec<S> spec,
                                                                                 NotificationSeed seed,
                                                                                 String correlationId) {
        Class<S> seedClass = spec.getSeedClass();
        S typed = seedClass.cast(seed);

        Attrs attrs = spec.attrs(typed);
        Map<String, String> attributes = attrs.asMap();
        Audience audience = spec.audience(typed);
        String title = spec.composeTitle(typed);
        String description = spec.composeDescription(typed);
        NotificationSeverity severity = spec.getSeverity();
        NotificationType specType = spec.getType();
        String applePushCategory = spec.getApplePushCategory().orElse(null);
        NotificationCategory category = spec.getCategory();
        NotificationSettingGroup settingsGroup = spec.getSettingsGroup().orElse(null);
        NotificationEntityRef entity = spec.entity(typed).orElse(null);
        return NotificationCommand.builder()
                .type(specType)
                .attributes(attributes)
                .applePushCategory(applePushCategory)
                .category(category)
                .settingsGroup(settingsGroup)
                .entity(entity)
                .title(title)
                .description(description)
                .severity(severity)
                .correlationId(correlationId)
                .audience(audience)
                .build();
    }
}
