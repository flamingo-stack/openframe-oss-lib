package com.openframe.stream.enrichment;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

final class EnrichmentJson {

    private EnrichmentJson() {
    }

    static String text(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asString();
    }

    static Double number(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.asDouble();
        }
        try {
            return Double.parseDouble(node.asString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static Instant instant(JsonNode node) {
        String text = text(node);
        if (text == null) {
            return null;
        }
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(text).toInstant();
            } catch (DateTimeParseException alsoIgnored) {
                try {
                    // NVD publishes "2024-01-01T00:00:00.000" with no zone — treat as UTC.
                    return OffsetDateTime.parse(text + "Z").toInstant();
                } catch (DateTimeParseException giveUp) {
                    return null;
                }
            }
        }
    }
}
