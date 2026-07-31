package com.openframe.data.util;

import com.openframe.data.document.rmm.ScriptPlatform;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class MachineOsClassifier {

    private static final Map<ScriptPlatform, List<String>> ALIASES = new EnumMap<>(Map.of(
            ScriptPlatform.WINDOWS, List.of("windows", "winnt", "win", "win32", "win64", "Windows 11"),
            ScriptPlatform.MACOS, List.of("macos", "mac_os", "mac-os", "mac os",
                    "macosx", "mac_os_x", "mac-os-x", "mac os x",
                    "osx", "os_x", "os-x", "os x",
                    "darwin", "mac")));

    private static final Map<String, ScriptPlatform> BY_NAME = Arrays.stream(ScriptPlatform.values())
            .collect(Collectors.toUnmodifiableMap(Enum::name, Function.identity()));

    private MachineOsClassifier() {
    }

    public static Optional<ScriptPlatform> classify(String rawOsType) {
        String canonical = canonical(rawOsType);
        if (canonical == null) {
            return Optional.empty();
        }
        return ALIASES.entrySet().stream()
                .filter(e -> e.getValue().stream().anyMatch(a -> canonical.equals(canonical(a))))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    public static Optional<ScriptPlatform> tryParse(String platformName) {
        return platformName == null ? Optional.empty() : Optional.ofNullable(BY_NAME.get(platformName));
    }

    public static String toMongoRegex(ScriptPlatform platform) {
        return ALIASES.getOrDefault(platform, List.of(platform.name())).stream()
                .map(MachineOsClassifier::separatorTolerantRegex)
                .distinct()
                .collect(Collectors.joining("|", "^(?:", ")$"));
    }

    private static String separatorTolerantRegex(String alias) {
        return Arrays.stream(alias.split("[\\s_-]+"))
                .filter(part -> !part.isEmpty())
                .map(Pattern::quote)
                .collect(Collectors.joining("[\\s_-]*"));
    }

    public static String matchRegex(String platformName) {
        return tryParse(platformName)
                .map(MachineOsClassifier::toMongoRegex)
                .orElseGet(() -> "^" + Pattern.quote(platformName) + "$");
    }

    private static String canonical(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        // Locale.ROOT — default locale would turn "WINDOWS" into "wındows" on tr_TR (dotless ı),
        // silently failing every alias match on JVMs running with a Turkish/Azeri locale.
        String stripped = value.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s_-]", "");
        return stripped.isEmpty() ? null : stripped;
    }
}
