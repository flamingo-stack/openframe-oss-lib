package com.openframe.data.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions.BigDecimalRepresentation;

/**
 * The one and only {@link MongoCustomConversions} definition in this library — Spring Data accepts a single
 * conversions bean, so a second one anywhere fails the context with an ambiguity error.
 * <p>
 * Always pins the UTC {@link LocalDateUtcMongoConverters} and writes {@link java.math.BigDecimal} as a string, as
 * Spring Data MongoDB 4 did; version 5 would hand it to the driver as Decimal128 and mix the stored types of money
 * fields. To add more converters, publish a
 * {@link MongoConversionsContributor} bean rather than another conversions bean; they are all applied here.
 */
@Configuration
public class MongoCustomConversionsConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions(ObjectProvider<MongoConversionsContributor> contributors) {
        return MongoCustomConversions.create(adapter -> {
            adapter.bigDecimal(BigDecimalRepresentation.STRING);
            adapter.registerConverters(LocalDateUtcMongoConverters.converters());
            contributors.orderedStream().forEach(contributor -> contributor.accept(adapter));
        });
    }
}
