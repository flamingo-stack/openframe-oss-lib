package com.openframe.client.service.rmm.osupdate.enrichment.parser;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

// CISA Known Exploited Vulnerabilities catalog, JSON feed.
@Component
@RequiredArgsConstructor
public class CisaKevCatalogParser {

    private final ObjectMapper objectMapper;

    // A catalog without its vulnerability list is broken, not empty: it must not clear the exploited flags.
    public Set<String> parse(InputStream kevCatalog) {
        JsonNode catalog = objectMapper.readTree(kevCatalog);
        JsonNode vulnerabilities = catalog.path("vulnerabilities");
        if (!vulnerabilities.isArray()) {
            throw new IllegalArgumentException("KEV catalog has no vulnerabilities list");
        }
        Set<String> cveIds = new HashSet<>();
        for (JsonNode vulnerability : vulnerabilities) {
            String cveId = vulnerability.path("cveID").asString("");
            if (!cveId.isBlank()) {
                cveIds.add(cveId);
            }
        }
        return cveIds;
    }
}
