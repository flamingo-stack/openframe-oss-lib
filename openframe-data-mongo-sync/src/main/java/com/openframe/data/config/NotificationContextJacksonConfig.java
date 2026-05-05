package com.openframe.data.config;

import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.jsontype.NamedType;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.openframe.data.document.notification.NotificationContextBinding;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Registers every {@link NotificationContextBinding} as a Jackson subtype so
 * the polymorphic {@code context} field round-trips on the wire and through
 * Mongo. {@code GenericContext} is the {@code @JsonTypeInfo(defaultImpl = ...)}
 * fallback for unknown {@code type} tokens, so it's not registered here.
 *
 * <p>Returned as a {@link Module} bean — Spring Boot auto-registers it onto
 * the primary {@code ObjectMapper}.
 */
@Configuration
public class NotificationContextJacksonConfig {

    @Bean
    public Module notificationContextSubtypesModule(List<NotificationContextBinding> bindings) {
        SimpleModule module = new SimpleModule("NotificationContextSubtypes");
        for (NotificationContextBinding binding : bindings) {
            module.registerSubtypes(new NamedType(binding.contextClass(), binding.type()));
        }
        return module;
    }
}
