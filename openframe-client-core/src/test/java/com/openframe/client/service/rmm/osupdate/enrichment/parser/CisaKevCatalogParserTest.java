package com.openframe.client.service.rmm.osupdate.enrichment.parser;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CisaKevCatalogParserTest {

    private final CisaKevCatalogParser parser = new CisaKevCatalogParser(new JsonMapper());

    @Test
    void parse_catalog_everyListedCve() throws IOException {
        // execution
        Set<String> cveIds;
        try (InputStream kevCatalog = MsrcCvrfDocumentParserTest.fixture("cisa-kev.json")) {
            cveIds = parser.parse(kevCatalog);
        }

        // verifications
        assertThat(cveIds).containsExactlyInAnyOrder("CVE-2026-124194", "CVE-2026-96951", "CVE-2026-81963");
    }

    @Test
    void parse_catalogWithoutItsList_failsInsteadOfClearingEveryFlag() {
        // setup
        InputStream kevCatalog = new ByteArrayInputStream("{\"title\":\"x\"}".getBytes(StandardCharsets.UTF_8));

        // execution / verifications
        assertThrows(IllegalArgumentException.class, () -> parser.parse(kevCatalog));
    }
}
