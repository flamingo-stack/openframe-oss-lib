package com.openframe.core.validation.tool;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import static org.springframework.util.StringUtils.hasText;

public final class ToolArgumentValuePatterns {

    private static final Map<String, Pattern> PATTERNS = new ConcurrentHashMap<>();
    public static final String ENVIRONMENT_ENTRY = "^[^=][\\s\\S]*=[\\s\\S]*$(?![\\s\\S])";

    private ToolArgumentValuePatterns() {
    }

    public static boolean isMatchingValue(ToolArgumentValueKind kind, Object operand, Object value) {
        if (!(value instanceof String text)) {
            return false;
        }
        return switch (kind) {
            case HAS_TEXT -> hasText(text);
            case NOT_TRIM_EMPTY -> !text.trim().isEmpty();
            case NOT_TRIM_BLANK -> !text.trim().isBlank();
            case PATTERN -> PATTERNS.computeIfAbsent((String) operand, Pattern::compile).matcher(text).matches();
            default -> throw new IllegalArgumentException("Not a text predicate: " + kind);
        };
    }

}
