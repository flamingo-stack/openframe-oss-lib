package com.openframe.stream.enrichment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashSet;
import java.util.Set;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
public class CisaKevClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String catalogPath;

    public CisaKevClient(
            @Value("${openframe.cve-enrichment.kev.base-url}") String baseUrl,
            @Value("${openframe.cve-enrichment.kev.path}") String catalogPath,
            ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.catalogPath = catalogPath;
        this.objectMapper = objectMapper;
    }

    public Set<String> knownExploitedCves() {
        Set<String> result = new HashSet<>();
        try {
            String body = restClient.get().uri(catalogPath).retrieve().body(String.class);
            JsonNode vulnerabilities = objectMapper.readTree(body).path("vulnerabilities");
            for (JsonNode row : vulnerabilities) {
                String cve = EnrichmentJson.text(row.path("cveID"));
                if (cve != null) {
                    result.add(cve);
                }
            }
            log.debug("[cve-enrichment] CISA KEV catalog loaded: {} CVEs", result.size());
        } catch (Exception e) {
            log.warn("[cve-enrichment] CISA KEV catalog fetch failed: {}", e.getMessage());
        }
        return result;
    }
}
