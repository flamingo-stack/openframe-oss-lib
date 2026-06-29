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

    /**
     * The {@link MongoCustomConversions} for contexts that import this config standalone (e.g. the
     * notification integration tests, which don't bring in {@link MongoInfraConfig}). Includes the
     * notification context converters plus the shared UTC {@link java.time.LocalDate} converters.
     * In full application contexts this is the single conversions bean; {@code MongoInfraConfig}'s
     * fallback is {@code @ConditionalOnMissingBean} so the two never collide.
     */
    @Bean
    public MongoCustomConversions notificationContextCustomConversions(
            NotificationContextReadConverter readConverter,
            NotificationContextWriteConverter writeConverter) {
        return new MongoCustomConversions(List.of(
                readConverter,
                writeConverter,
                LocalDateUtcMongoConverters.LocalDateToUtcDateConverter.INSTANCE,
                LocalDateUtcMongoConverters.UtcDateToLocalDateConverter.INSTANCE));
    }
}
