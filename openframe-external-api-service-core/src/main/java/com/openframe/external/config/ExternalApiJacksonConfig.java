package com.openframe.external.config;

import tools.jackson.core.JsonGenerator;
import tools.jackson.databind.module.SimpleModule;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueSerializer;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoUnit;

/**
 * Uniform timestamp precision for the external API: every {@link Instant} is written as an
 * ISO-8601 UTC string truncated to milliseconds. Without this, freshly created entities echo
 * nanosecond precision (in-memory {@code Instant.now()}) while reads return milliseconds (Mongo's
 * storage precision), so write and read responses disagree on the same field.
 */
@Configuration
public class ExternalApiJacksonConfig {

    /** Always three fraction digits, so a whole-second instant is ...05.000Z rather than ...05Z. */
    private static final DateTimeFormatter ISO_INSTANT_MILLIS = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();

    @Bean
    public JsonMapperBuilderCustomizer externalApiInstantMillisCustomizer() {
        SimpleModule module = new SimpleModule("external-api-instant-millis");
        module.addSerializer(Instant.class, new ValueSerializer<>() {
            @Override
            public void serialize(Instant value, JsonGenerator gen, SerializationContext serializers) {
                gen.writeString(ISO_INSTANT_MILLIS.format(value.truncatedTo(ChronoUnit.MILLIS)));
            }
        });
        return builder -> builder.addModule(module);
    }
}
