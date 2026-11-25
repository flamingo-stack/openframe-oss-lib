package com.openframe.management.osupdate;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.management.osupdate.parser.MsrcCvrfDocumentParser;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;

import java.time.Duration;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

// MSRC CVRF API v3.0, no authentication. One document per Patch Tuesday month, keyed like 2026-Nov.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.enrichment.enabled"},
        havingValue = "true")
public class MsrcCvrfClient {

    private static final DateTimeFormatter MONTH_ID = DateTimeFormatter.ofPattern("yyyy-MMM", Locale.ENGLISH);
    private static final int CACHED_MONTHS = 6;

    private final RestClient restClient;
    private final MsrcCvrfDocumentParser msrcCvrfDocumentParser;
    private final OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;
    private final Cache<YearMonth, MsrcCvrfBulletin> msrcCvrfBulletinsByMonth;

    public MsrcCvrfClient(
            MsrcCvrfDocumentParser msrcCvrfDocumentParser,
            OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics,
            @Value("${openframe.rmm.os-update.enrichment.msrc.base-url:https://api.msrc.microsoft.com/cvrf/v3.0}")
            String baseUrl,
            @Value("${openframe.rmm.os-update.enrichment.msrc.timeout:60s}") Duration timeout,
            @Value("${openframe.rmm.os-update.enrichment.msrc.cache-ttl:6h}") Duration cacheTtl) {
        this.msrcCvrfDocumentParser = msrcCvrfDocumentParser;
        this.osUpdateEnrichmentMetrics = osUpdateEnrichmentMetrics;
        this.restClient = PackageSearchRestClientFactory.create(baseUrl, timeout);
        this.msrcCvrfBulletinsByMonth = Caffeine.newBuilder()
                .expireAfterWrite(cacheTtl)
                .maximumSize(CACHED_MONTHS)
                .build();
    }

    // A month MSRC has no document for (not yet published) has no KB. A failure is not cached.
    public Map<String, MsrcKbArticle> getKbArticles(YearMonth month) {
        return getBulletin(month).getKbArticles();
    }

    // By the Windows version as the agent reports it ("11 24H2"). A month MSRC has no document for has no build.
    public Map<String, MsrcWindowsBuild> getWindowsBuilds(YearMonth month) {
        return getBulletin(month).getWindowsBuilds();
    }

    private MsrcCvrfBulletin getBulletin(YearMonth month) {
        return msrcCvrfBulletinsByMonth.get(month, this::fetchBulletin);
    }

    private MsrcCvrfBulletin fetchBulletin(YearMonth month) {
        try {
            MsrcCvrfBulletin msrcCvrfBulletin = readBulletin(month);
            osUpdateEnrichmentMetrics.recordSourceFetched(OsUpdateSource.MSRC_CVRF);
            return msrcCvrfBulletin;
        } catch (OsUpdateSourceUnavailableException failure) {
            osUpdateEnrichmentMetrics.recordSourceFailed(OsUpdateSource.MSRC_CVRF);
            throw failure;
        }
    }

    private MsrcCvrfBulletin readBulletin(YearMonth month) {
        String monthId = MONTH_ID.format(month);
        try {
            return restClient.get()
                    .uri("/cvrf/{monthId}", monthId)
                    .accept(MediaType.APPLICATION_JSON)
                    .exchange((request, response) -> {
                        if (response.getStatusCode().isSameCodeAs(HttpStatus.NOT_FOUND)) {
                            return MsrcCvrfBulletin.builder()
                                    .kbArticles(Map.of())
                                    .windowsBuilds(Map.of())
                                    .build();
                        }
                        if (!response.getStatusCode().is2xxSuccessful()) {
                            throw new OsUpdateSourceUnavailableException(OsUpdateSource.MSRC_CVRF,
                                    "MSRC CVRF " + monthId + " answered " + response.getStatusCode().value());
                        }
                        return msrcCvrfDocumentParser.parse(response.getBody());
                    });
        } catch (RestClientException | JacksonException | IllegalArgumentException failure) {
            throw new OsUpdateSourceUnavailableException(OsUpdateSource.MSRC_CVRF,
                    "MSRC CVRF " + monthId + " could not be read", failure);
        }
    }
}
