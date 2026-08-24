package com.openframe.notification.spec;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isBlank;

public final class Attrs {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, String> values;

    private Attrs(Map<String, String> values) {
        this.values = values;
    }

    public static Attrs of(Map<String, String> values) {
        Map<String, String> copied = Map.copyOf(values);
        return new Attrs(copied);
    }

    public String get(AttrKey key) {
        String name = key.getName();
        String value = values.get(name);
        if (isBlank(value)) {
            throw new NoSuchElementException("attribute '" + name + "' is absent");
        }
        return value;
    }

    public Optional<String> optional(AttrKey key) {
        String name = key.getName();
        String value = values.get(name);
        return Optional.ofNullable(value).filter(v -> !isBlank(v));
    }

    public boolean has(AttrKey key) {
        Optional<String> value = optional(key);
        return value.isPresent();
    }

    public <T> T json(AttrKey key, TypeReference<T> type) {
        String name = key.getName();
        String value = get(key);
        try {
            return JSON.readValue(value, type);
        } catch (Exception ex) {
            // The value comes from a spec factory, so a parse failure is a producer-side bug, not bad input.
            throw new IllegalStateException("attribute '" + name + "' does not hold valid JSON", ex);
        }
    }

    public Attrs with(AttrKey key, String value) {
        if (isBlank(value)) {
            return this;
        }
        String name = key.getName();
        Map<String, String> next = new HashMap<>(values);
        next.put(name, value);
        Map<String, String> copied = Map.copyOf(next);
        return new Attrs(copied);
    }

    public Map<String, String> asMap() {
        return values;
    }
}
