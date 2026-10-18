package com.openframe.stream.enrichment;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class EnrichmentJsonTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    private JsonNode node(String json) {
        return mapper.readTree(json);
    }

    private JsonNode missing() {
        return mapper.readTree("{}").path("absent");
    }

    @Test
    void text_returnsNullForNullMissingAndJsonNull() {
        assertThat(EnrichmentJson.text(null)).isNull();
        assertThat(EnrichmentJson.text(missing())).isNull();
        assertThat(EnrichmentJson.text(node("null"))).isNull();
    }

    @Test
    void text_returnsStringValue() {
        assertThat(EnrichmentJson.text(node("\"CVE-2024-1\""))).isEqualTo("CVE-2024-1");
    }

    @Test
    void number_returnsNullForNullMissingAndJsonNull() {
        assertThat(EnrichmentJson.number(null)).isNull();
        assertThat(EnrichmentJson.number(missing())).isNull();
        assertThat(EnrichmentJson.number(node("null"))).isNull();
    }

    @Test
    void number_parsesNumericNode() {
        assertThat(EnrichmentJson.number(node("7.8"))).isEqualTo(7.8);
    }

    @Test
    void number_parsesNumberHeldAsString() {
        assertThat(EnrichmentJson.number(node("\"3.14\""))).isEqualTo(3.14);
    }

    @Test
    void number_returnsNullForNonNumericString() {
        assertThat(EnrichmentJson.number(node("\"not-a-number\""))).isNull();
    }

    @Test
    void instant_parsesIsoUtc() {
        assertThat(EnrichmentJson.instant(node("\"2024-01-01T00:00:00Z\"")))
                .isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
    }

    @Test
    void instant_parsesOffsetDateTime() {
        assertThat(EnrichmentJson.instant(node("\"2024-01-01T02:00:00+02:00\"")))
                .isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
    }

    @Test
    void instant_treatsZonelessTimestampAsUtc() {
        // NVD publishes "2024-01-01T00:00:00.000" with no zone.
        assertThat(EnrichmentJson.instant(node("\"2024-01-01T00:00:00.000\"")))
                .isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
    }

    @Test
    void instant_returnsNullForNullAndGarbage() {
        assertThat(EnrichmentJson.instant(null)).isNull();
        assertThat(EnrichmentJson.instant(node("null"))).isNull();
        assertThat(EnrichmentJson.instant(node("\"nope\""))).isNull();
    }
}
