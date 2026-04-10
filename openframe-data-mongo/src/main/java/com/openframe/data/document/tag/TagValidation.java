package com.openframe.data.document.tag;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Shared validation rules for tag keys and values.
 * Must start with an alphanumeric character, followed by alphanumeric, underscore, or hyphen.
 * Maximum length: 64 characters.
 */
public final class TagValidation {

    private TagValidation() {}

    public static final int MAX_LENGTH = 64;
    public static final Pattern PATTERN = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9_-]*$");

    public static void validateKey(String key) {
        if (key == null || key.isEmpty()) {
            throw new IllegalArgumentException("Tag key must not be empty");
        }
        if (key.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "Tag key '%s' exceeds maximum length of %d characters".formatted(key, MAX_LENGTH));
        }
        if (!PATTERN.matcher(key).matches()) {
            throw new IllegalArgumentException(
                    "Tag key '%s' is invalid: must start with alphanumeric and contain only alphanumeric, underscore, or hyphen".formatted(key));
        }
    }

    public static void validateValue(String value, String key) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException(
                    "Tag value must not be empty for key '%s'".formatted(key));
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "Tag value '%s' for key '%s' exceeds maximum length of %d characters".formatted(value, key, MAX_LENGTH));
        }
        if (!PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException(
                    "Tag value '%s' for key '%s' is invalid: must start with alphanumeric and contain only alphanumeric, underscore, or hyphen".formatted(value, key));
        }
    }

    public static void validateValues(List<String> values, String key) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            validateValue(value, key);
        }
    }
}
