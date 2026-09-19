package com.openframe.external.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExternalApiJacksonConfigTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        Jackson2ObjectMapperBuilder builder = Jackson2ObjectMapperBuilder.json();
        new ExternalApiJacksonConfig().externalApiInstantMillisCustomizer().customize(builder);
        mapper = builder.build();
    }

    @ParameterizedTest
    @CsvSource({
            "2024-01-02T03:04:05.123456789Z, 2024-01-02T03:04:05.123Z",
            "2024-01-02T03:04:05.123999999Z, 2024-01-02T03:04:05.123Z",
            "2024-01-02T03:04:05.123456Z,    2024-01-02T03:04:05.123Z",
            "2024-01-02T03:04:05.123Z,       2024-01-02T03:04:05.123Z",
            "2024-01-02T03:04:05.100Z,       2024-01-02T03:04:05.100Z",
            "2024-01-02T03:04:05.000999Z,    2024-01-02T03:04:05Z",
            "2024-01-02T03:04:05Z,           2024-01-02T03:04:05Z",
            "1969-12-31T23:59:59.999999999Z, 1969-12-31T23:59:59.999Z"
    })
    void instantsAreWrittenAsIsoUtcTruncatedToMillis(String instant, String expected) throws Exception {
        assertEquals('"' + expected + '"', mapper.writeValueAsString(Instant.parse(instant)));
    }

    @Test
    void instantsWithAnOffsetAreNormalizedToUtc() throws Exception {
        Instant instant = Instant.parse("2024-01-02T05:04:05.123456+02:00");

        assertEquals("\"2024-01-02T03:04:05.123Z\"", mapper.writeValueAsString(instant));
    }

    @Test
    void instantFieldsInsideResponsesAreTruncatedToo() throws Exception {
        Instant created = Instant.parse("2024-01-02T03:04:05.123456789Z");
        Map<String, Object> nested = new LinkedHashMap<>();
        nested.put("history", List.of(created));
        nested.put("closedAt", null);

        JsonNode json = mapper.valueToTree(new Payload("t-1", created, null, nested));

        assertEquals("t-1", json.get("id").asText());
        assertEquals("2024-01-02T03:04:05.123Z", json.get("createdAt").asText());
        assertTrue(json.get("updatedAt").isNull());
        assertEquals("2024-01-02T03:04:05.123Z", json.get("extra").get("history").get(0).asText());
        assertTrue(json.get("extra").get("closedAt").isNull());
    }

    @Test
    void writtenInstantsReadBackAtMillisecondPrecision() throws Exception {
        Instant original = Instant.parse("2024-01-02T03:04:05.123456789Z");

        Instant readBack = mapper.readValue(mapper.writeValueAsString(original), Instant.class);

        assertEquals(Instant.parse("2024-01-02T03:04:05.123Z"), readBack);
    }

    @Test
    void customizerInstallsItsModuleAlongsideTheDefaultOnes() {
        assertTrue(mapper.getRegisteredModuleIds().contains("external-api-instant-millis"));
        assertTrue(mapper.getRegisteredModuleIds().size() > 1);
    }

    record Payload(String id, Instant createdAt, Instant updatedAt, Map<String, Object> extra) {
    }
}
