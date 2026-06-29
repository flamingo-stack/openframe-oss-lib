package com.openframe.data.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.repository.notification.NotificationContextReadConverter;
import com.openframe.data.repository.notification.NotificationContextWriteConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

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

    // The MongoCustomConversions bean is aggregated centrally in MongoInfraConfig (which also adds the
    // UTC LocalDate converters), so these converters are exposed as plain beans and collected there.
}
