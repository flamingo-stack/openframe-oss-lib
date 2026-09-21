package com.openframe.data.document.tag;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Shared validation rules for tag keys and values.
 * Must start with an alphanumeric character, followed by alphanumeric, underscore, or hyphen.
 * Maximum length: 64 characters.
 *
 * <p>Note: these are shared constants/pattern checks used to keep validation rules
 * consistent between API-layer Bean Validation constraints and any service-level
 * business rule checks. This class does not itself constitute the sanctioned
 * validation layer (API request Bean Validation or service business rules per
 * OFJAVA-025); callers at those layers should perform the actual enforcement
 * using {@link #MAX_LENGTH} and {@link #PATTERN} directly (e.g. via
 * {@code @Size} / {@code @Pattern} annotations or explicit service checks)
 * rather than relying on this class to throw.
 */
public final class TagValidation {

    private TagValidation() {}

    public static final int MAX_LENGTH = 64;
    public static final Pattern PATTERN = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9_-]*$");

    public static boolean isValidKey(String key) {
        return key != null
                && !key.isEmpty()
                && key.length() <= MAX_LENGTH
                && PATTERN.matcher(key).matches();
    }

    public static boolean isValidValue(String value) {
        return value != null
                && !value.isEmpty()
                && value.length() <= MAX_LENGTH
                && PATTERN.matcher(value).matches();
    }

    public static boolean isValidValues(List<String> values) {
        if (values == null) {
            return true;
        }
        for (String value : values) {
            if (!isValidValue(value)) {
                return false;
            }
        }
        return true;
    }
}

