package com.openframe.notification.spec;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import static java.util.stream.Collectors.toUnmodifiableSet;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Slf4j
public final class Attrs {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, String> values;

    private Attrs(Map<String, String> values) {
        this.values = values;
    }

    public static Attrs seed(NotificationTypeSpec spec, Map<String, String> raw) {
        rejectMissingSeedKeys(spec, raw);
        Map<String, String> declared = dropUndeclaredSeedKeys(spec, raw);
        return new Attrs(declared);
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
            // The value is spec-written, so a parse failure is a spec bug, not bad input.
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

    private static void rejectMissingSeedKeys(NotificationTypeSpec spec, Map<String, String> raw) {
        for (AttrKey key : spec.seedKeys()) {
            String name = key.getName();
            String value = raw.get(name);
            if (isBlank(value)) {
                String type = spec.type();
                throw new IllegalArgumentException(
                        type + ": required seed attribute '" + name + "' is missing or blank");
            }
        }
    }

    // Undeclared keys are dropped, not rejected: a producer may start emitting a fact before the
    // catalog consumes it. The WARN is what keeps a typo in an optional key from hiding forever.
    private static Map<String, String> dropUndeclaredSeedKeys(NotificationTypeSpec spec, Map<String, String> raw) {
        Set<String> declared = declaredKeyNames(spec);
        Map<String, String> kept = new HashMap<>();
        Set<String> dropped = new TreeSet<>();
        for (Map.Entry<String, String> entry : raw.entrySet()) {
            String key = entry.getKey();
            if (declared.contains(key)) {
                kept.put(key, entry.getValue());
            } else {
                dropped.add(key);
            }
        }
        if (!dropped.isEmpty()) {
            String type = spec.type();
            log.warn("{}: ignoring undeclared seed attribute(s) {}", type, dropped);
        }
        return Map.copyOf(kept);
    }

    private static Set<String> declaredKeyNames(NotificationTypeSpec spec) {
        Set<String> required = spec.seedKeys().stream().map(AttrKey::getName).collect(toUnmodifiableSet());
        Set<String> optional = spec.optionalSeedKeys().stream().map(AttrKey::getName).collect(toUnmodifiableSet());
        Set<String> declared = new TreeSet<>(required);
        declared.addAll(optional);
        return declared;
    }
}
