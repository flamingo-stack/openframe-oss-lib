package com.openframe.data.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

/**
 * The one and only {@link MongoCustomConversions} definition in this library — Spring Data accepts a single
 * conversions bean, so a second one anywhere fails the context with an ambiguity error.
 * <p>
 * Always pins the UTC {@link LocalDateUtcMongoConverters}. To add more converters, publish a
 * {@link MongoConversionsContributor} bean rather than another conversions bean; they are all applied here.
 * See {@code NotificationContextMongoConfig} for an example.
 */
@Configuration
public class MongoCustomConversionsConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions(ObjectProvider<MongoConversionsContributor> contributors) {
        return MongoCustomConversions.create(adapter -> {
            adapter.registerConverters(LocalDateUtcMongoConverters.converters());
            contributors.orderedStream().forEach(contributor -> contributor.accept(adapter));
        });
    }
}
