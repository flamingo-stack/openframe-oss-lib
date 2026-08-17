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

public final class Attrs {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, String> values;

    private Attrs(Map<String, String> values) {
        this.values = values;
    }

    public static Attrs seed(NotificationTypeSpec spec, Map<String, String> raw) {
        rejectMissingSeedKeys(spec, raw);
        rejectUnknownSeedKeys(spec, raw);
        Map<String, String> copied = Map.copyOf(raw);
        return new Attrs(copied);
    }

    public static Attrs of(Map<String, String> values) {
        Map<String, String> copied = Map.copyOf(values);
        return new Attrs(copied);
    }

    public String get(AttrKey key) {
        String name = key.name();
        String value = values.get(name);
        if (isBlank(value)) {
            throw new NoSuchElementException("attribute '" + name + "' is absent");
        }
        return value;
    }

    public Optional<String> optional(AttrKey key) {
        String name = key.name();
        String value = values.get(name);
        return Optional.ofNullable(value).filter(v -> !isBlank(v));
    }

    public boolean has(AttrKey key) {
        Optional<String> value = optional(key);
        return value.isPresent();
    }

    public <T> T json(AttrKey key, TypeReference<T> type) {
        String name = key.name();
        String value = get(key);
        try {
            return JSON.readValue(value, type);
        } catch (Exception ex) {
            // The value is spec-written, so a parse failure is a spec bug, not bad input.
            throw new IllegalStateException("attribute '" + name + "' does not hold valid JSON", ex);
        }
    }

    public Attrs with(AttrKey key, String value) {
        if (isBlank(value)) {
            return this;
        }
        String name = key.name();
        Map<String, String> next = new HashMap<>(values);
        next.put(name, value);
        Map<String, String> copied = Map.copyOf(next);
        return new Attrs(copied);
    }

    public Map<String, String> asMap() {
        return values;
    }

    private static void rejectMissingSeedKeys(NotificationTypeSpec spec, Map<String, String> raw) {
        for (AttrKey key : spec.seedKeys()) {
            String name = key.name();
            String value = raw.get(name);
            if (isBlank(value)) {
                String type = spec.type();
                throw new IllegalArgumentException(
                        type + ": required seed attribute '" + name + "' is missing or blank");
            }
        }
    }

    private static void rejectUnknownSeedKeys(NotificationTypeSpec spec, Map<String, String> raw) {
        Set<String> allowed = spec.seedKeys().stream().map(AttrKey::name).collect(toUnmodifiableSet());
        for (String key : raw.keySet()) {
            if (!allowed.contains(key)) {
                String type = spec.type();
                throw new IllegalArgumentException(type + ": unknown seed attribute '" + key + "'");
            }
        }
    }
}
