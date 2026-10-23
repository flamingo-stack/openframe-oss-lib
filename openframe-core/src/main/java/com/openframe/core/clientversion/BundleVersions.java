package com.openframe.core.clientversion;

import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class BundleVersions {

    private static final Pattern NUMERIC_PREFIX = Pattern.compile("^(\\d{1,9})\\.(\\d{1,9})\\.(\\d{1,9})");

    private BundleVersions() {
    }

    // A version that does not parse is never below: an unknown client must not be blocked.
    public static boolean isBelow(String version, String minimum) {
        int[] versionParts = numericParts(version);
        int[] minimumParts = numericParts(minimum);
        if (versionParts.length == 0 || minimumParts.length == 0) {
            return false;
        }
        return Arrays.compare(versionParts, minimumParts) < 0;
    }

    private static int[] numericParts(String version) {
        if (version == null) {
            return new int[0];
        }
        Matcher matcher = NUMERIC_PREFIX.matcher(version);
        if (!matcher.find()) {
            return new int[0];
        }
        int major = Integer.parseInt(matcher.group(1));
        int minor = Integer.parseInt(matcher.group(2));
        int patch = Integer.parseInt(matcher.group(3));
        return new int[]{major, minor, patch};
    }
}
