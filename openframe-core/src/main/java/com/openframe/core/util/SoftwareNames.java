package com.openframe.core.util;

import lombok.experimental.UtilityClass;

import java.util.Collection;
import java.util.Objects;
import java.util.regex.Pattern;

@UtilityClass
public class SoftwareNames {

    public static final String UNNAMED = "Unnamed software";

    private static final Pattern INVISIBLE_EDGES =
            Pattern.compile("^[\\s\\p{Z}\\p{Cf}\\p{Cc}]+|[\\s\\p{Z}\\p{Cf}\\p{Cc}]+$");
    private static final Pattern INSTALLER_PLACEHOLDER = Pattern.compile("\\$\\{\\{[^}]*}}");
    private static final Pattern GUID = Pattern.compile(
            "\\{?\\p{XDigit}{8}-\\p{XDigit}{4}-\\p{XDigit}{4}-\\p{XDigit}{4}-\\p{XDigit}{12}}?");

    public static String displayName(String name, String bundleIdentifier) {
        String visibleName = displayable(name);
        if (visibleName != null) {
            return visibleName;
        }
        String visibleBundleIdentifier = visible(bundleIdentifier);
        return visibleBundleIdentifier != null ? visibleBundleIdentifier : UNNAMED;
    }

    public static String displayable(String name) {
        String visibleName = visible(name);
        if (visibleName == null || INSTALLER_PLACEHOLDER.matcher(visibleName).find()
                || GUID.matcher(visibleName).matches()) {
            return null;
        }
        return visibleName;
    }

    public static String firstDisplayable(Collection<String> names) {
        if (names == null) {
            return null;
        }
        return names.stream()
                .map(SoftwareNames::displayable)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private static String visible(String value) {
        if (value == null) {
            return null;
        }
        String stripped = INVISIBLE_EDGES.matcher(value).replaceAll("");
        return stripped.isEmpty() ? null : stripped;
    }
}
