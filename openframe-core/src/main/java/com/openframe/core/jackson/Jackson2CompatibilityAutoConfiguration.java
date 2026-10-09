package com.openframe.core.jackson;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

/**
 * Applies {@link Jackson2Compatibility} to the Spring-managed {@code JsonMapper}, so data and partner payloads that
 * Jackson 2 accepted are still read the same way after the Jackson 3 upgrade.
 * <p>
 * Ordered before Spring Boot's own customizer so an explicit
 * {@code spring.jackson.deserialization.fail-on-null-for-primitives} still wins.
 */
@AutoConfiguration
public class Jackson2CompatibilityAutoConfiguration {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public JsonMapperBuilderCustomizer jackson2CompatibleReadsCustomizer() {
        return Jackson2Compatibility::apply;
    }
}
