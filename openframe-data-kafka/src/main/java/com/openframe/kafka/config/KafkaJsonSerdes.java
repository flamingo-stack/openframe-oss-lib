package com.openframe.kafka.config;

import com.openframe.core.jackson.Jackson2Compatibility;
import org.springframework.kafka.support.JacksonMapperUtils;
import org.springframework.kafka.support.serializer.JacksonJsonDeserializer;
import org.springframework.kafka.support.serializer.JacksonJsonSerializer;
import tools.jackson.databind.json.JsonMapper;

/**
 * Value (de)serializers for the producer and consumer factories. Kafka instantiates a (de)serializer configured by
 * class name with its own mapper, which the Spring-managed Jackson settings never reach; handing the factory an
 * instance keeps messages read and written the way they were before the Jackson 3 upgrade
 * ({@link Jackson2Compatibility}). The factory still calls {@code configure(...)} on it, so trusted packages, type
 * mappings and type headers from the properties keep applying.
 */
public final class KafkaJsonSerdes {

    private KafkaJsonSerdes() {
    }

    public static JacksonJsonDeserializer<Object> valueDeserializer() {
        return new JacksonJsonDeserializer<>(mapper());
    }

    public static JacksonJsonSerializer<Object> valueSerializer() {
        return new JacksonJsonSerializer<>(mapper());
    }

    private static JsonMapper mapper() {
        return Jackson2Compatibility.apply(JacksonMapperUtils.enhancedJsonMapper().rebuild()).build();
    }
}
