package com.openframe.management.osupdate.parser;

import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// CISA Known Exploited Vulnerabilities catalog, JSON feed.
@Component
@RequiredArgsConstructor
public class CisaKevCatalogParser {

    private final ObjectMapper objectMapper;

    // A catalog without its vulnerability list is broken, not empty: it must not clear the exploited flags.
    public Set<String> parse(InputStream kevCatalog) {
        CisaKevCatalog cisaKevCatalog = objectMapper.readValue(kevCatalog, CisaKevCatalog.class);
        List<CisaKevCatalog.CisaKevVulnerability> cisaKevVulnerabilities = cisaKevCatalog.getCisaKevVulnerabilities();
        if (cisaKevVulnerabilities == null) {
            throw new IllegalArgumentException("KEV catalog has no vulnerabilities list");
        }
        return cisaKevVulnerabilities.stream()
                .map(CisaKevCatalog.CisaKevVulnerability::getCveId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toSet());
    }
}
