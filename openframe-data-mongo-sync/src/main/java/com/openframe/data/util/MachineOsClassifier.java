package com.openframe.data.util;

import com.openframe.data.document.rmm.ScriptPlatform;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class MachineOsClassifier {

    private static final Map<ScriptPlatform, String> PATTERNS = new EnumMap<>(Map.of(
            // Windows: agents always send a full "windows"/"winnt" string
            ScriptPlatform.WINDOWS, "windows|winnt",
            // macOS: "macOS", "Mac OS X", "mac", raw "darwin" (what Rust std reports), "osx".
            ScriptPlatform.MACOS, "mac|darwin|osx"));

    private static final List<Map.Entry<ScriptPlatform, Pattern>> COMPILED = PATTERNS.entrySet().stream()
            .map(e -> Map.entry(e.getKey(), Pattern.compile(e.getValue(), Pattern.CASE_INSENSITIVE)))
            .toList();

    private static final Map<String, ScriptPlatform> BY_NAME = Arrays.stream(ScriptPlatform.values())
            .collect(Collectors.toUnmodifiableMap(Enum::name, Function.identity()));

    private MachineOsClassifier() {
    }

    public static Optional<ScriptPlatform> classify(String rawOsType) {
        if (rawOsType == null || rawOsType.isBlank()) {
            return Optional.empty();
        }
        return COMPILED.stream()
                .filter(e -> e.getValue().matcher(rawOsType).find())
                .map(Map.Entry::getKey)
                .findFirst();
    }

    public static Optional<ScriptPlatform> tryParse(String platformName) {
        return platformName == null ? Optional.empty() : Optional.ofNullable(BY_NAME.get(platformName));
    }

    public static String toMongoRegex(ScriptPlatform platform) {
        String fragment = PATTERNS.get(platform);
        return fragment != null ? fragment : Pattern.quote(platform.name());
    }

    public static String matchRegex(String platformName) {
        return tryParse(platformName)
                .map(MachineOsClassifier::toMongoRegex)
                .orElseGet(() -> "^" + Pattern.quote(platformName) + "$");
    }
}
