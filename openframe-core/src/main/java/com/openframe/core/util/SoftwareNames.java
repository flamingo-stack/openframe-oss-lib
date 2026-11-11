package com.openframe.core.util;

import lombok.experimental.UtilityClass;

import java.util.regex.Pattern;

@UtilityClass
public class SoftwareNames {

    public static final String UNNAMED = "Unnamed software";

    private static final Pattern INVISIBLE_EDGES =
            Pattern.compile("^[\\s\\p{Z}\\p{Cf}\\p{Cc}]+|[\\s\\p{Z}\\p{Cf}\\p{Cc}]+$");

    public static String displayName(String name, String bundleIdentifier) {
        String visibleName = visible(name);
        if (visibleName != null) {
            return visibleName;
        }
        String visibleBundleIdentifier = visible(bundleIdentifier);
        return visibleBundleIdentifier != null ? visibleBundleIdentifier : UNNAMED;
    }

    private static String visible(String value) {
        if (value == null) {
            return null;
        }
        String stripped = INVISIBLE_EDGES.matcher(value).replaceAll("");
        return stripped.isEmpty() ? null : stripped;
    }
}
