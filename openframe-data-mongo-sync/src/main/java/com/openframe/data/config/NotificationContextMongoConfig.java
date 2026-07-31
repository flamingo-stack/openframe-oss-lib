package com.openframe.data.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.repository.notification.NotificationContextReadConverter;
import com.openframe.data.repository.notification.NotificationContextWriteConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.util.List;

@Configuration
@Import({NotificationContextJacksonConfig.class, MongoCustomConversionsConfig.class})
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
    public MongoConversionsContributor notificationContextConversionsContributor(
            NotificationContextReadConverter readConverter,
            NotificationContextWriteConverter writeConverter) {
        return adapter -> adapter.registerConverters(List.of(readConverter, writeConverter));
    }
}
