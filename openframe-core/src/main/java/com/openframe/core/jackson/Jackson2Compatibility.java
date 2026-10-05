package com.openframe.core.jackson;

import com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility;
import org.springframework.http.codec.ClientCodecConfigurer;
import org.springframework.http.codec.json.JacksonJsonDecoder;
import org.springframework.http.codec.json.JacksonJsonEncoder;
import org.springframework.http.converter.HttpMessageConverters;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.cfg.MapperBuilder;
import tools.jackson.databind.json.JsonMapper;

/**
 * Keeps JSON the way it was before the Jackson 3 upgrade, for the Spring-managed mapper
 * ({@link Jackson2CompatibilityAutoConfiguration}) and mappers built by hand:
 * <ul>
 *     <li>a missing or {@code null} primitive becomes its default instead of failing the read;</li>
 *     <li>a class with a no-args constructor is read through it, keeping its field defaults
 *     ({@link PreferNoArgsConstructorIntrospector});</li>
 *     <li>properties are written in declaration order, not alphabetically, so API responses, messages and the
 *     tool results models see keep their shape;</li>
 *     <li>constructors of any visibility can bind a class, e.g. the package-private one Lombok's {@code @Builder}
 *     generates, as Jackson 2 allowed.</li>
 * </ul>
 * A {@code WebClient.builder()} or {@code RestClient.builder()} encodes and decodes with its own default mapper, so
 * clients built that way take these settings through {@link #webClientCodecs} or {@link #restClientConverters}.
 */
public final class Jackson2Compatibility {

    private Jackson2Compatibility() {
    }

    public static <B extends MapperBuilder<?, B>> B apply(B builder) {
        return builder
                .disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
                .disable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
                .changeDefaultVisibility(visibility -> visibility.withCreatorVisibility(Visibility.ANY))
                .annotationIntrospector(new PreferNoArgsConstructorIntrospector());
    }

    /** A plain {@link JsonMapper} with these settings, for code that cannot use the Spring-managed one. */
    public static JsonMapper jsonMapper() {
        return apply(JsonMapper.builder()).build();
    }

    /** For {@code WebClient.builder().codecs(Jackson2Compatibility::webClientCodecs)}. */
    public static void webClientCodecs(ClientCodecConfigurer codecs) {
        JsonMapper mapper = jsonMapper();
        codecs.defaultCodecs().jacksonJsonDecoder(new JacksonJsonDecoder(mapper));
        codecs.defaultCodecs().jacksonJsonEncoder(new JacksonJsonEncoder(mapper));
    }

    /** For {@code RestClient.builder().configureMessageConverters(Jackson2Compatibility::restClientConverters)}. */
    public static void restClientConverters(HttpMessageConverters.ClientBuilder converters) {
        converters.withJsonConverter(new JacksonJsonHttpMessageConverter(jsonMapper()));
    }
}
