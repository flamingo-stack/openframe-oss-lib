package com.openframe.core.validation.tool;

import lombok.Value;
import lombok.experimental.Accessors;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.MatchResult;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import static java.util.regex.Matcher.quoteReplacement;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toList;

/** Projects trim and ROOT case normalization from existing enum names and class patterns. */
public final class ToolArgumentNormalizationPatterns {

    private static final String TRIM_PADDING = "[\\u0000-\\u0020]*";
    private static final Pattern POSITIVE_CLASS = Pattern.compile("\\[([^\\]\\^]+)\\]");
    private static final Pattern CLASS_EXPRESSION = Pattern.compile("(?:(?:\\[[a-zA-Z0-9.\\-]+\\]|\\\\\\.)(?:[+*?]|\\{[0-9]+(?:,[0-9]*)?\\})?)+");
    private static final Map<String, List<Integer>> UPPERCASE = preimages(true);
    private static final Map<String, List<Integer>> LOWERCASE = preimages(false);

    private ToolArgumentNormalizationPatterns() {
    }

    public static String uppercaseEnum(List<String> values) {
        String choices = values.stream().map(ToolArgumentNormalizationPatterns::word).collect(joining("|"));
        return "^" + TRIM_PADDING + "(?:" + choices + ")" + TRIM_PADDING + "$(?![\\s\\S])";
    }

    public static Optional<String> lowercaseClasses(String expression) {
        if (!expression.startsWith("^") || !expression.endsWith("$")) {
            return Optional.empty();
        }
        String originalBody = expression.substring(1, expression.length() - 1);
        if (!CLASS_EXPRESSION.matcher(originalBody).matches()) {
            return Optional.empty();
        }
        String expanded = POSITIVE_CLASS.matcher(expression).replaceAll(ToolArgumentNormalizationPatterns::expandClass);
        String body = expanded.substring(1, expanded.length() - 1);
        return Optional.of("^" + TRIM_PADDING + "(?:" + body + ")" + TRIM_PADDING + "$(?![\\s\\S])");
    }

    private static Map<String, List<Integer>> preimages(boolean uppercase) {
        return IntStream.rangeClosed(Character.MIN_CODE_POINT, Character.MAX_CODE_POINT)
                .filter(code -> !Character.isSurrogate((char) code) || code > Character.MAX_VALUE)
                .mapToObj(code -> normalized(code, uppercase)).filter(ToolArgumentNormalizationPatterns::isAsciiNormalizedValue)
                .collect(groupingBy(Normalized::value, mapping(Normalized::code, toList())));
    }

    private static Normalized normalized(int code, boolean uppercase) {
        String original = new String(Character.toChars(code));
        String value = uppercase ? original.toUpperCase(Locale.ROOT) : original.toLowerCase(Locale.ROOT);
        return new Normalized(code, value);
    }

    private static boolean isAsciiNormalizedValue(Normalized value) {
        return !value.value().isEmpty() && value.value().chars().allMatch(character -> character < 128);
    }

    private static String word(String value) {
        if (value.isEmpty()) {
            return "";
        }
        String choices = UPPERCASE.entrySet().stream().filter(entry -> value.startsWith(entry.getKey()))
                .map(entry -> "(?:" + sourceCharacters(entry.getValue()) + ")" + word(value.substring(entry.getKey().length())))
                .collect(joining("|"));
        return groupChoices(choices);
    }

    private static String expandClass(MatchResult match) {
        Pattern accepted = Pattern.compile(match.group());
        String choices = LOWERCASE.entrySet().stream().filter(entry -> accepted.matcher(entry.getKey()).matches())
                .flatMap(entry -> entry.getValue().stream()).map(ToolArgumentNormalizationPatterns::escape).collect(joining("|"));
        return quoteReplacement(groupChoices(choices));
    }

    private static String groupChoices(String choices) {
        return choices.isEmpty() ? "(?!)" : "(?:" + choices + ")";
    }

    private static String sourceCharacters(List<Integer> codes) {
        return codes.stream().map(ToolArgumentNormalizationPatterns::escape).collect(joining("|"));
    }

    private static String escape(int code) {
        return new String(Character.toChars(code)).chars().mapToObj(character -> String.format("\\u%04x", character)).collect(joining());
    }

    @Value
    @Accessors(fluent = true)
    private static class Normalized {

        private final int code;
        private final String value;

    }
}
