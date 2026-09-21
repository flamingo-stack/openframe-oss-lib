package com.openframe.management.packagesearch;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class BrewCountParsingTest {

    @Test
    void parsesCommaSeparatedCounts() {
        // brew analytics serialise counts as strings with comma thousands-separators
        assertEquals(537301, BrewCatalogFetcher.parseCount("537,301"));
        assertEquals(419, BrewCatalogFetcher.parseCount("419"));
    }

    @Test
    void returnsNullForGarbage() {
        assertNull(BrewCatalogFetcher.parseCount("n/a"));
    }
}
