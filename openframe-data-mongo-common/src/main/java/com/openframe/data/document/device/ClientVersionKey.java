package com.openframe.data.document.device;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

// major.minor.patch as one comparable number: major * 10^12 + minor * 10^6 + patch; whatever follows the triple is ignored
public final class ClientVersionKey {

    private static final Pattern NUMERIC_TRIPLE = Pattern.compile("^[vV]?(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?");
    private static final int MAX_PART_DIGITS = 6;
    private static final long MAJOR_FACTOR = 1_000_000_000_000L;
    private static final long MINOR_FACTOR = 1_000_000L;
    private static final int MAJOR_GROUP = 1;
    private static final int MINOR_GROUP = 2;
    private static final int PATCH_GROUP = 3;

    private ClientVersionKey() {
    }

    public static Long parse(String version) {
        if (version == null) {
            return null;
        }
        String trimmed = version.trim();
        Matcher matcher = NUMERIC_TRIPLE.matcher(trimmed);
        if (!matcher.find() || !partsFit(matcher)) {
            return null;
        }
        long major = part(matcher, MAJOR_GROUP);
        long minor = part(matcher, MINOR_GROUP);
        long patch = part(matcher, PATCH_GROUP);
        return major * MAJOR_FACTOR + minor * MINOR_FACTOR + patch;
    }

    // A part of seven digits or more would spill into the next part's range
    private static boolean partsFit(Matcher matcher) {
        return fits(matcher.group(MAJOR_GROUP))
                && fits(matcher.group(MINOR_GROUP))
                && fits(matcher.group(PATCH_GROUP));
    }

    private static boolean fits(String part) {
        return part == null || part.length() <= MAX_PART_DIGITS;
    }

    private static long part(Matcher matcher, int group) {
        String digits = matcher.group(group);
        return digits == null ? 0L : Long.parseLong(digits);
    }
}
