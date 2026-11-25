package com.openframe.api.service.rmm.osupdate.release;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.core.rest.PackageSearchRestClientFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;

import java.time.Duration;
import java.util.List;

// endoflife.date, no authentication.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.os-versions.enabled"},
        havingValue = "true")
@Slf4j
public class WindowsReleaseClient {

    private static final String RELEASES = "releases";

    private final RestClient restClient;
    private final String releasesPath;
    private final WindowsReleaseParser windowsReleaseParser;
    private final WindowsReleaseMetrics windowsReleaseMetrics;
    private final Cache<String, List<WindowsRelease>> windowsReleases;

    public WindowsReleaseClient(
            WindowsReleaseParser windowsReleaseParser,
            WindowsReleaseMetrics windowsReleaseMetrics,
            @Value("${openframe.rmm.os-update.os-versions.endoflife.base-url:https://endoflife.date}") String baseUrl,
            @Value("${openframe.rmm.os-update.os-versions.endoflife.path:/api/windows.json}") String releasesPath,
            @Value("${openframe.rmm.os-update.os-versions.endoflife.timeout:10s}") Duration timeout,
            @Value("${openframe.rmm.os-update.os-versions.endoflife.cache-ttl:6h}") Duration cacheTtl) {
        this.windowsReleaseParser = windowsReleaseParser;
        this.windowsReleaseMetrics = windowsReleaseMetrics;
        this.releasesPath = releasesPath;
        this.restClient = PackageSearchRestClientFactory.create(baseUrl, timeout);
        this.windowsReleases = Caffeine.newBuilder()
                .expireAfterWrite(cacheTtl)
                .maximumSize(1)
                .build();
    }

    // A failure is not cached: empty now, the next call asks again.
    public List<WindowsRelease> listWindowsReleases() {
        try {
            return windowsReleases.get(RELEASES, key -> fetchWindowsReleases());
        } catch (RestClientException | JacksonException | IllegalArgumentException | IllegalStateException failure) {
            log.warn("endoflife.date Windows releases could not be read: {}", failure.getMessage());
            windowsReleaseMetrics.recordSourceFailed();
            return List.of();
        }
    }

    private List<WindowsRelease> fetchWindowsReleases() {
        return restClient.get()
                .uri(releasesPath)
                .accept(MediaType.APPLICATION_JSON)
                .exchange((request, response) -> {
                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new IllegalStateException("endoflife.date answered " + response.getStatusCode().value());
                    }
                    return windowsReleaseParser.parse(response.getBody());
                });
    }
}
