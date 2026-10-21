package com.openframe.client.service.release;

import com.openframe.client.config.AgentBinaryPolicyProperties;
import com.openframe.client.config.AgentBinaryPolicyProperties.ReleaseSource;
import com.openframe.client.service.release.model.GitHubRelease;
import com.openframe.client.service.release.model.GitHubReleaseAsset;
import com.openframe.client.service.release.model.ReleaseBinaryChecksums;
import com.openframe.client.service.release.model.ReleaseChecksumLookup;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

import static org.springframework.http.MediaType.APPLICATION_OCTET_STREAM;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
public class GitHubReleaseChecksumClient {

    private static final String GITHUB_API_URL = "https://api.github.com";
    private static final String RELEASE_BY_TAG_PATH = "/repos/{owner}/{repository}/releases/tags/{tag}";
    private static final String CHECKSUMS_ASSET_NAME = "checksums.json";
    private static final String GITHUB_JSON = "application/vnd.github+json";
    private static final String BEARER_PREFIX = "Bearer ";
    // runs inline in agent registration, so a slow GitHub must not stall it
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final ReleaseSource releases;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    @Autowired
    public GitHubReleaseChecksumClient(AgentBinaryPolicyProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, GITHUB_API_URL);
    }

    GitHubReleaseChecksumClient(AgentBinaryPolicyProperties properties, ObjectMapper objectMapper, String apiUrl) {
        this.releases = properties.getReleases();
        this.objectMapper = objectMapper;
        this.restClient = createRestClient(apiUrl);
    }

    // the asset redirect is followed by hand so the token is never sent on to the storage host
    private static RestClient createRestClient(String apiUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(TIMEOUT)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(TIMEOUT);
        return RestClient.builder()
                .baseUrl(apiUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public ReleaseChecksumLookup fetch(String version) {
        try {
            return fetchPublished(version);
        } catch (HttpClientErrorException.NotFound e) {
            log.debug("No release {} in {}/{}", version, releases.getOwner(), releases.getRepository());
            return ReleaseChecksumLookup.notPublished();
        } catch (RestClientException | JacksonException e) {
            log.warn("Failed to fetch release checksums for version {} from {}/{}",
                    version, releases.getOwner(), releases.getRepository(), e);
            return ReleaseChecksumLookup.unavailable();
        }
    }

    private ReleaseChecksumLookup fetchPublished(String version) {
        GitHubRelease release = fetchRelease(version);
        List<GitHubReleaseAsset> assets = release.getAssets();
        return assets.stream()
                .filter(GitHubReleaseChecksumClient::isChecksumsAsset)
                .findFirst()
                .map(this::downloadChecksums)
                .map(ReleaseChecksumLookup::found)
                .orElseGet(ReleaseChecksumLookup::notPublished);
    }

    private GitHubRelease fetchRelease(String version) {
        String owner = releases.getOwner();
        String repository = releases.getRepository();
        String body = restClient.get()
                .uri(RELEASE_BY_TAG_PATH, owner, repository, version)
                .header(HttpHeaders.ACCEPT, GITHUB_JSON)
                .headers(this::authorize)
                .retrieve()
                .body(String.class);
        return objectMapper.readValue(body, GitHubRelease.class);
    }

    private static boolean isChecksumsAsset(GitHubReleaseAsset asset) {
        return CHECKSUMS_ASSET_NAME.equals(asset.getName());
    }

    private ReleaseBinaryChecksums downloadChecksums(GitHubReleaseAsset asset) {
        String assetUrl = asset.getUrl();
        ResponseEntity<String> response = restClient.get()
                .uri(assetUrl)
                .accept(APPLICATION_OCTET_STREAM)
                .headers(this::authorize)
                .retrieve()
                .toEntity(String.class);
        String body = readAssetBody(response);
        return objectMapper.readValue(body, ReleaseBinaryChecksums.class);
    }

    private String readAssetBody(ResponseEntity<String> response) {
        if (!isRedirect(response)) {
            return response.getBody();
        }
        HttpHeaders headers = response.getHeaders();
        URI location = headers.getLocation();
        return restClient.get()
                .uri(location)
                .retrieve()
                .body(String.class);
    }

    private static boolean isRedirect(ResponseEntity<String> response) {
        return response.getStatusCode().is3xxRedirection();
    }

    private void authorize(HttpHeaders headers) {
        String token = releases.getToken();
        if (hasText(token)) {
            headers.set(HttpHeaders.AUTHORIZATION, BEARER_PREFIX + token);
        }
    }
}
