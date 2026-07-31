package com.openframe.data.config;

import org.springframework.data.mongodb.core.convert.MongoCustomConversions.MongoConverterConfigurationAdapter;

import java.util.function.Consumer;

/**
 * Contributes converters to the single {@link org.springframework.data.mongodb.core.convert.MongoCustomConversions}
 * bean built by {@link MongoCustomConversionsConfig}.
 * <p>
 * Register one of these as a {@code @Bean} instead of defining another {@code MongoCustomConversions}: Spring
 * Data accepts exactly one conversions bean, so a second one fails the context with an ambiguity error. Note
 * that {@code @ConditionalOnMissingBean} is <em>not</em> a way around that here — every service app declares an
 * explicit {@code @ComponentScan} over {@code com.openframe.data}, which drops Boot's
 * {@code AutoConfigurationExcludeFilter} and gets the auto-configurations in this package registered a second
 * time as plain scanned configs, where the condition is evaluated too early to see its sibling.
 */
@FunctionalInterface
public interface MongoConversionsContributor extends Consumer<MongoConverterConfigurationAdapter> {
}
