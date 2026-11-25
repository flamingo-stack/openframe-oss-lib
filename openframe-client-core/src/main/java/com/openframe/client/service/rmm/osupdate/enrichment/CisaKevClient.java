package com.openframe.client.service.rmm.osupdate.enrichment;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.client.service.rmm.osupdate.enrichment.parser.CisaKevCatalogParser;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;

import java.time.Duration;
import java.util.Set;

// CISA Known Exploited Vulnerabilities catalog, no authentication.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.enrichment.enabled"},
        havingValue = "true")
public class CisaKevClient {

    private static final String CATALOG = "catalog";

    private final RestClient restClient;
    private final String catalogPath;
    private final CisaKevCatalogParser cisaKevCatalogParser;
    private final Cache<String, Set<String>> knownExploitedCveIds;

    public CisaKevClient(
            CisaKevCatalogParser cisaKevCatalogParser,
            @Value("${openframe.rmm.os-update.enrichment.kev.base-url:https://www.cisa.gov}") String baseUrl,
            @Value("${openframe.rmm.os-update.enrichment.kev.path:/sites/default/files/feeds/known_exploited_vulnerabilities.json}")
            String catalogPath,
            @Value("${openframe.rmm.os-update.enrichment.kev.timeout:30s}") Duration timeout,
            @Value("${openframe.rmm.os-update.enrichment.kev.cache-ttl:6h}") Duration cacheTtl) {
        this.cisaKevCatalogParser = cisaKevCatalogParser;
        this.catalogPath = catalogPath;
        this.restClient = PackageSearchRestClientFactory.create(baseUrl, timeout);
        this.knownExploitedCveIds = Caffeine.newBuilder()
                .expireAfterWrite(cacheTtl)
                .maximumSize(1)
                .build();
    }

    // A failure is not cached.
    public Set<String> getKnownExploitedCveIds() {
        return knownExploitedCveIds.get(CATALOG, key -> fetchKnownExploitedCveIds());
    }

    private Set<String> fetchKnownExploitedCveIds() {
        try {
            return restClient.get()
                    .uri(catalogPath)
                    .accept(MediaType.APPLICATION_JSON)
                    .exchange((request, response) -> {
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new OsUpdateSourceUnavailableException(OsUpdateSource.CISA_KEV,
                                    "CISA KEV answered " + response.getStatusCode().value());
                        }
                        return cisaKevCatalogParser.parse(response.getBody());
                    });
        } catch (RestClientException | JacksonException | IllegalArgumentException failure) {
            throw new OsUpdateSourceUnavailableException(OsUpdateSource.CISA_KEV, "CISA KEV could not be read", failure);
        }
    }
}
