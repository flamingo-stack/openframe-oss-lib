package com.openframe.data.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.repository.notification.NotificationContextReadConverter;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.List;

/**
 * Wires the notification-context polymorphism into Spring Data Mongo: a read
 * converter for the embedded {@code context} field, and a selective type mapper
 * that suppresses {@code _class} for the hierarchy.
 *
 * <p>The type mapper is installed via {@link BeanPostProcessor} on purpose —
 * overriding the {@code MappingMongoConverter} bean would clobber other
 * module-level configuration (e.g. {@code MongoSyncConfig}).
 */
@Configuration
@Import(NotificationContextJacksonConfig.class)
public class NotificationContextMongoConfig {

    @Bean
    public NotificationContextReadConverter notificationContextReadConverter(ObjectMapper objectMapper) {
        return new NotificationContextReadConverter(objectMapper);
    }

    @Bean
    public MongoCustomConversions notificationContextCustomConversions(
            NotificationContextReadConverter readConverter) {
        return new MongoCustomConversions(List.of(readConverter));
    }

    @Bean
    public static BeanPostProcessor notificationContextTypeMapperPostProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                if (bean instanceof MappingMongoConverter converter) {
                    converter.setTypeMapper(new NotificationContextSelectiveTypeMapper(converter.getMappingContext()));
                }
                return bean;
            }
        };
    }
}
