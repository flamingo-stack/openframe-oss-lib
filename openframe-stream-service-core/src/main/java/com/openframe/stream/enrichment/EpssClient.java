package com.openframe.stream.enrichment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
public class EpssClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public EpssClient(@Value("${openframe.cve-enrichment.epss.base-url}") String baseUrl,
                      ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.objectMapper = objectMapper;
    }

    public Map<String, Double> fetch(List<String> cveIds) {
        Map<String, Double> result = new HashMap<>();
        if (cveIds == null || cveIds.isEmpty()) {
            return result;
        }
        try {
            String body = restClient.get()
                    .uri("/data/v1/epss?cve={cves}", String.join(",", cveIds))
                    .retrieve()
                    .body(String.class);
            JsonNode data = objectMapper.readTree(body).path("data");
            for (JsonNode row : data) {
                String cve = EnrichmentJson.text(row.path("cve"));
                Double epss = EnrichmentJson.number(row.path("epss"));
                if (cve != null && epss != null) {
                    result.put(cve, epss);
                }
            }
        } catch (Exception e) {
            log.warn("[cve-enrichment] EPSS fetch failed for {} CVEs: {}", cveIds.size(), e.getMessage());
        }
        return result;
    }
}
