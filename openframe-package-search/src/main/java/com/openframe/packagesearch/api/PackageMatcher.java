package com.openframe.packagesearch.api;

import java.util.Collection;
import java.util.Locale;

final class PackageMatcher {

    private static final int ID_EXACT = 100;
    private static final int ID_PREFIX = 85;
    private static final int ID_CONTAINS = 60;
    private static final int NAME_EXACT = 95;
    private static final int NAME_PREFIX = 80;
    private static final int NAME_CONTAINS = 55;
    private static final int ALIAS_EXACT = 90;
    private static final int ALIAS_PREFIX = 75;
    private static final int ALIAS_CONTAINS = 50;
    private static final int DESCRIPTION_PHRASE = 20;

    private PackageMatcher() {
    }

    // query must already be lower-cased and trimmed; 0 = no match, ties are broken by the caller
    static int score(String query, String id, String name, Collection<String> aliases, String description) {
        String idLower = lower(id);
        String nameLower = lower(name);

        int best = 0;
        int idScore = fieldScore(query, idLower, ID_EXACT, ID_PREFIX, ID_CONTAINS);
        best = Math.max(best, idScore);
        int nameScore = fieldScore(query, nameLower, NAME_EXACT, NAME_PREFIX, NAME_CONTAINS);
        best = Math.max(best, nameScore);
        best = Math.max(best, bestAliasScore(query, aliases));
        if (best > 0) {
            return best;
        }
        String descriptionLower = lower(description);
        if (descriptionLower.contains(query)) {
            return DESCRIPTION_PHRASE;
        }
        return 0;
    }

    private static int bestAliasScore(String query, Collection<String> aliases) {
        if (aliases == null) {
            return 0;
        }
        int best = 0;
        for (String alias : aliases) {
            String aliasLower = lower(alias);
            int aliasScore = fieldScore(query, aliasLower, ALIAS_EXACT, ALIAS_PREFIX, ALIAS_CONTAINS);
            best = Math.max(best, aliasScore);
        }
        return best;
    }

    private static int fieldScore(String query, String candidate, int exact, int prefix, int contains) {
        if (candidate.isEmpty()) {
            return 0;
        }
        if (candidate.equals(query)) {
            return exact;
        }
        if (candidate.startsWith(query)) {
            return prefix;
        }
        if (candidate.contains(query)) {
            return contains;
        }
        return 0;
    }

    private static String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
