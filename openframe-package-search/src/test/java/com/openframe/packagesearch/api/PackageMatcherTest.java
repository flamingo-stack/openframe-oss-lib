package com.openframe.packagesearch.api;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PackageMatcherTest {

    @Test
    void exactIdBeatsPrefixBeatsContains() {
        int exact = PackageMatcher.score("slack", "slack", "Slack", List.of(), null);
        int prefix = PackageMatcher.score("slack", "slack-cli", "slack-cli", List.of(), null);
        int contains = PackageMatcher.score("slack", "font-slackey", "font-slackey", List.of(), null);

        assertTrue(exact > prefix);
        assertTrue(prefix > contains);
        assertTrue(contains > 0);
    }

    @Test
    void matchesCaseInsensitively() {
        assertEquals(100, PackageMatcher.score("firefox", "Firefox", "Mozilla Firefox (en-US)", List.of(), null));
    }

    @Test
    void matchesAliases() {
        assertTrue(PackageMatcher.score("postgres", "postgresql@18", "postgresql@18",
                List.of("postgres"), null) >= 90);
    }

    @Test
    void descriptionOnlyMatchScoresLow() {
        int score = PackageMatcher.score("collaboration", "slack", "Slack", List.of(),
                "Team communication and collaboration software");

        assertEquals(20, score);
    }

    @Test
    void wholePhraseInDescriptionBeatsScatteredWords() {
        assertEquals(20, PackageMatcher.score("json processor", "jq", "jq", List.of(),
                "Lightweight and flexible command-line JSON processor"));
    }

    @Test
    void scatteredWordsDoNotMatch() {
        // the query must appear as one phrase; per-word matching was removed together with the
        // Mongo pre-filter that used to feed it
        assertEquals(0, PackageMatcher.score("processor lightweight", "jq", "jq", List.of(),
                "Lightweight and flexible command-line JSON processor"));
    }

    @Test
    void noMatchScoresZero() {
        assertEquals(0, PackageMatcher.score("slack", "jq", "jq", List.of(), "JSON processor"));
    }
}
