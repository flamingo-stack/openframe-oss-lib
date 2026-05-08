package com.openframe.data.config;

import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.jsontype.NamedType;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.openframe.data.document.notification.NotificationContextBinding;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

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
