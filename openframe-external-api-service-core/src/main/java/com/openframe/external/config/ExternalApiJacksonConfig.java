package com.openframe.external.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
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
    public Jackson2ObjectMapperBuilderCustomizer externalApiInstantMillisCustomizer() {
        SimpleModule module = new SimpleModule("external-api-instant-millis");
        module.addSerializer(Instant.class, new JsonSerializer<>() {
            @Override
            public void serialize(Instant value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                gen.writeString(ISO_INSTANT_MILLIS.format(value.truncatedTo(ChronoUnit.MILLIS)));
            }
        });
        return builder -> builder.modulesToInstall(module);
    }
}
