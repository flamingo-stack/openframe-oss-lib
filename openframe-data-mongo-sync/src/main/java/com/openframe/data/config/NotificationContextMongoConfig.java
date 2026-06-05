package com.openframe.data.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.repository.notification.NotificationContextReadConverter;
import com.openframe.data.repository.notification.NotificationContextWriteConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.List;

@Configuration
@Import(NotificationContextJacksonConfig.class)
public class NotificationContextMongoConfig {

    @Bean
    public NotificationContextReadConverter notificationContextReadConverter(ObjectMapper objectMapper) {
        return new NotificationContextReadConverter(objectMapper);
    }

    @Bean
    public NotificationContextWriteConverter notificationContextWriteConverter(ObjectMapper objectMapper) {
        return new NotificationContextWriteConverter(objectMapper);
    }

    @Bean
    public MongoCustomConversions notificationContextCustomConversions(
            NotificationContextReadConverter readConverter,
            NotificationContextWriteConverter writeConverter) {
        return new MongoCustomConversions(List.of(readConverter, writeConverter));
    }
}
