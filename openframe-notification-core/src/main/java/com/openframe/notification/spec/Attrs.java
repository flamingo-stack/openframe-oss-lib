package com.openframe.notification.spec;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;
import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * Immutable string-map view of a notification's facts. Validation happens once, at the producer
 * boundary ({@link #seed}); enriched values are spec-authored and therefore trusted.
 */
public final class Attrs {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, String> values;

    private Attrs(Map<String, String> values) {
        this.values = values;
    }

    /** Producer boundary: every seed key present and non-blank, no keys outside the declared set. */
    public static Attrs seed(NotificationTypeSpec spec, Map<String, String> raw) {
        Set<String> allowed = spec.seedKeys().stream().map(AttrKey::name).collect(toUnmodifiableSet());
        for (AttrKey key : spec.seedKeys()) {
            if (isBlank(raw.get(key.name()))) {
                throw new IllegalArgumentException(
                        spec.type() + ": required seed attribute '" + key.name() + "' is missing or blank");
            }
        }
        for (String key : raw.keySet()) {
            if (!allowed.contains(key)) {
                throw new IllegalArgumentException(spec.type() + ": unknown seed attribute '" + key + "'");
            }
        }
        return new Attrs(Map.copyOf(raw));
    }

    public static Attrs of(Map<String, String> values) {
        return new Attrs(Map.copyOf(values));
    }

    public String get(AttrKey key) {
        String value = values.get(key.name());
        if (isBlank(value)) {
            throw new NoSuchElementException("attribute '" + key.name() + "' is absent");
        }
        return value;
    }

    public Optional<String> optional(AttrKey key) {
        return Optional.ofNullable(values.get(key.name())).filter(v -> !isBlank(v));
    }

    public boolean has(AttrKey key) {
        return optional(key).isPresent();
    }

    /** Parses a JSON-string attribute value. The value is spec-written, so a parse failure is a spec bug. */
    public <T> T json(AttrKey key, TypeReference<T> type) {
        String value = get(key);
        try {
            return JSON.readValue(value, type);
        } catch (Exception ex) {
            throw new IllegalStateException("attribute '" + key.name() + "' does not hold valid JSON", ex);
        }
    }

    /** Returns a copy with the value set; a null/blank value leaves the attribute absent. */
    public Attrs with(AttrKey key, String value) {
        if (isBlank(value)) {
            return this;
        }
        Map<String, String> next = new HashMap<>(values);
        next.put(key.name(), value);
        return new Attrs(Map.copyOf(next));
    }

    public Map<String, String> asMap() {
        return values;
    }
}
