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
 * Always pins the UTC {@link LocalDateUtcMongoConverters} and writes {@link java.math.BigDecimal} as Decimal128, the
 * Mongo decimal type (Spring Data MongoDB 4 wrote a string; both read back into {@code BigDecimal}). The shared
 * billing collections are converted by a migration in the shared management service. Tenant databases and OSS
 * installations are not migrated: {@code organizations.monthlyRevenue} holds strings next to Decimal128 values,
 * and so may a shared field written by a Spring Boot 3 pod during the rollout. Both read back, but a query that
 * compares or sums such a field ({@code $gt}, {@code $sum}) needs the old values converted first. To add more converters, publish a
 * {@link MongoConversionsContributor} bean rather than another conversions bean; they are all applied here.
 */
@Configuration
public class MongoCustomConversionsConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions(ObjectProvider<MongoConversionsContributor> contributors) {
        return MongoCustomConversions.create(adapter -> {
            adapter.bigDecimal(BigDecimalRepresentation.DECIMAL128);
            adapter.registerConverters(LocalDateUtcMongoConverters.converters());
            contributors.orderedStream().forEach(contributor -> contributor.configure(adapter));
        });
    }
}
