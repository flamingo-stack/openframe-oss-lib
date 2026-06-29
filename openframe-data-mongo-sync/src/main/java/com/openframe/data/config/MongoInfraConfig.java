package com.openframe.data.config;

import com.openframe.data.repository.notification.NotificationContextReadConverter;
import com.openframe.data.repository.notification.NotificationContextWriteConverter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.convert.DbRefResolver;
import org.springframework.data.mongodb.core.convert.DefaultDbRefResolver;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Configuration
@ConditionalOnProperty(name = "spring.data.mongodb.enabled", havingValue = "true", matchIfMissing = false)
@EnableMongoAuditing
public class MongoInfraConfig {

    /**
     * Single source of truth for Mongo custom converters. Always registers UTC {@link LocalDate} &lt;-&gt;
     * {@code Date} conversion so the same LocalDate is persisted/read identically regardless of the
     * JVM/container timezone (Spring's default JSR-310 converters use {@code ZoneId.systemDefault()},
     * which made pods in different zones store the same date 2h apart and produce duplicate
     * {@code product_usage_periods} docs). Notification-context converters are aggregated here too when
     * present, replacing the previous standalone MongoCustomConversions.
     */
    @Bean
    public MongoCustomConversions mongoCustomConversions(
            ObjectProvider<NotificationContextReadConverter> notificationReadConverter,
            ObjectProvider<NotificationContextWriteConverter> notificationWriteConverter) {
        List<Object> converters = new ArrayList<>();
        converters.add(LocalDateToUtcDateConverter.INSTANCE);
        converters.add(UtcDateToLocalDateConverter.INSTANCE);
        notificationReadConverter.ifAvailable(converters::add);
        notificationWriteConverter.ifAvailable(converters::add);
        return new MongoCustomConversions(converters);
    }

    @Bean
    public MappingMongoConverter mappingMongoConverter(MongoDatabaseFactory factory,
                                                       MongoMappingContext context,
                                                       MongoCustomConversions conversions) {
        DbRefResolver dbRefResolver = new DefaultDbRefResolver(factory);
        MappingMongoConverter converter = new MappingMongoConverter(dbRefResolver, context);
        converter.setCustomConversions(conversions);
        converter.setMapKeyDotReplacement("__dot__");
        return converter;
    }

    @WritingConverter
    enum LocalDateToUtcDateConverter implements Converter<LocalDate, Date> {
        INSTANCE;

        @Override
        public Date convert(LocalDate source) {
            return Date.from(source.atStartOfDay(ZoneOffset.UTC).toInstant());
        }
    }

    @ReadingConverter
    enum UtcDateToLocalDateConverter implements Converter<Date, LocalDate> {
        INSTANCE;

        @Override
        public LocalDate convert(Date source) {
            return LocalDateTime.ofInstant(source.toInstant(), ZoneOffset.UTC).toLocalDate();
        }
    }
}
