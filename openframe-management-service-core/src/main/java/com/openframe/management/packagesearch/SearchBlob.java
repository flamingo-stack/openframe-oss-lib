package com.openframe.management.packagesearch;

import java.util.List;
import java.util.Locale;
import java.util.StringJoiner;

// pre-lowered haystack the api service filters on in Mongo, so search never depends on
// per-request case handling
final class SearchBlob {

    private SearchBlob() {
    }

    static String of(String packageId, String name, String description, List<String> aliases) {
        StringJoiner joiner = new StringJoiner(" ");
        append(joiner, packageId);
        append(joiner, name);
        append(joiner, description);
        if (aliases != null) {
            aliases.forEach(alias -> append(joiner, alias));
        }
        return joiner.toString();
    }

    private static void append(StringJoiner joiner, String value) {
        if (value != null && !value.isBlank()) {
            joiner.add(value.toLowerCase(Locale.ROOT));
        }
    }
}
