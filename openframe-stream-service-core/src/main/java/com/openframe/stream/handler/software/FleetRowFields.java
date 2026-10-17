package com.openframe.stream.handler.software;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

final class FleetRowFields {

    private FleetRowFields() {
    }

    static boolean isDelete(String op) {
        return "d".equals(op);
    }

    static boolean isGlobalStats(JsonNode row) {
        return Boolean.TRUE.equals(boolOrNull(row, "global_stats"));
    }

    static String str(JsonNode row, String field) {
        JsonNode v = row.get(field);
        return v == null || v.isNull() ? null : v.asString();
    }

    static int intOr(JsonNode row, String field, int fallback) {
        JsonNode v = row.get(field);
        return v == null || v.isNull() ? fallback : v.asInt();
    }

    static Long longOrNull(JsonNode row, String field) {
        JsonNode v = row.get(field);
        return v == null || v.isNull() ? null : v.asLong();
    }

    static Double doubleOrNull(JsonNode row, String field) {
        JsonNode v = row.get(field);
        return v == null || v.isNull() ? null : v.asDouble();
    }

    static Boolean boolOrNull(JsonNode row, String field) {
        JsonNode v = row.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isBoolean()) {
            return v.asBoolean();
        }
        if (v.isNumber()) {
            return v.asInt() != 0;
        }
        return null;
    }

    static Instant instantOrNull(JsonNode row, String field) {
        JsonNode v = row.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            long n = v.asLong();
            return n >= 1_000_000_000_000_000L ? Instant.ofEpochMilli(n / 1_000L) : Instant.ofEpochMilli(n);
        }
        String text = v.asString();
        try {
            return Instant.parse(text);
        } catch (DateTimeParseException ignored) {
            try {
                return OffsetDateTime.parse(text).toInstant();
            } catch (DateTimeParseException alsoIgnored) {
                return null;
            }
        }
    }

    static String severityOf(Double cvssScore) {
        if (cvssScore == null) {
            return null;
        }
        if (cvssScore >= 9.0) {
            return "CRITICAL";
        }
        if (cvssScore >= 7.0) {
            return "HIGH";
        }
        if (cvssScore >= 4.0) {
            return "MEDIUM";
        }
        if (cvssScore > 0.0) {
            return "LOW";
        }
        return "NONE";
    }
}
