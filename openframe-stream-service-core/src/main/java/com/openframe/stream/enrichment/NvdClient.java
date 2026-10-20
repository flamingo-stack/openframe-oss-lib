package com.openframe.stream.enrichment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

@Component
@Slf4j
@ConditionalOnProperty(name = "openframe.cve-enrichment.enabled", havingValue = "true")
public class NvdClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public NvdClient(
            @Value("${openframe.cve-enrichment.nvd.base-url}") String baseUrl,
            @Value("${openframe.cve-enrichment.nvd.api-key}") String apiKey,
            ObjectMapper objectMapper) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.objectMapper = objectMapper;
    }

    public NvdCveData fetch(String cveId) {
        try {
            String body = restClient.get()
                    .uri("/rest/json/cves/2.0?cveId={cve}", cveId)
                    .headers(headers -> {
                        if (apiKey != null && !apiKey.isBlank()) {
                            headers.set("apiKey", apiKey);
                        }
                    })
                    .retrieve()
                    .body(String.class);
            JsonNode cve = objectMapper.readTree(body).path("vulnerabilities").path(0).path("cve");
            if (cve.isMissingNode() || cve.isNull()) {
                return null;
            }
            return parse(cve);
        } catch (Exception e) {
            log.warn("[cve-enrichment] NVD fetch failed for {}: {}", cveId, e.getMessage());
            return null;
        }
    }

    private NvdCveData parse(JsonNode cve) {
        Instant published = EnrichmentJson.instant(cve.path("published"));
        String description = englishDescription(cve.path("descriptions"));
        String cweId = firstCwe(cve.path("weaknesses"));

        JsonNode cvssData = firstCvssData(cve.path("metrics"));
        Double score = cvssData == null ? null : EnrichmentJson.number(cvssData.path("baseScore"));
        String severity = cvssData == null ? null : EnrichmentJson.text(cvssData.path("baseSeverity"));
        if (severity == null && score != null) {
            severity = severityFromScore(score);
        }
        return new NvdCveData(score, severity == null ? null : severity.toUpperCase(), published, description, cweId);
    }

    private JsonNode firstCvssData(JsonNode metrics) {
        for (String key : new String[]{"cvssMetricV31", "cvssMetricV30", "cvssMetricV2"}) {
            JsonNode arr = metrics.path(key);
            if (arr.isArray() && !arr.isEmpty()) {
                return arr.path(0).path("cvssData");
            }
        }
        return null;
    }

    private String englishDescription(JsonNode descriptions) {
        for (JsonNode d : descriptions) {
            if ("en".equals(EnrichmentJson.text(d.path("lang")))) {
                return EnrichmentJson.text(d.path("value"));
            }
        }
        return null;
    }

    private String firstCwe(JsonNode weaknesses) {
        for (JsonNode w : weaknesses) {
            for (JsonNode d : w.path("description")) {
                String value = EnrichmentJson.text(d.path("value"));
                if (value != null && value.startsWith("CWE-")) {
                    return value;
                }
            }
        }
        return null;
    }

    private static String severityFromScore(double score) {
        if (score >= 9.0) {
            return "CRITICAL";
        }
        if (score >= 7.0) {
            return "HIGH";
        }
        if (score >= 4.0) {
            return "MEDIUM";
        }
        if (score > 0.0) {
            return "LOW";
        }
        return "NONE";
    }

    public record NvdCveData(Double cvssScore, String severity, Instant published, String description, String cweId) {
    }
}
