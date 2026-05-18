package com.openframe.data.config;

import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.jsontype.NamedType;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.openframe.data.document.notification.NotificationContextDescriptor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class NotificationContextJacksonConfig {

    @Bean
    public Module notificationContextSubtypesModule(List<NotificationContextDescriptor> descriptors) {
        SimpleModule module = new SimpleModule("NotificationContextSubtypes");
        for (NotificationContextDescriptor descriptor : descriptors) {
            module.registerSubtypes(new NamedType(descriptor.contextClass(), descriptor.type()));
        }
        return module;
    }
}
