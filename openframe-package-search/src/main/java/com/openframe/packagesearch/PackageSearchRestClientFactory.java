package com.openframe.packagesearch;

import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

public final class PackageSearchRestClientFactory {

    // distinctive UA so upstream repositories can identify our traffic
    private static final String USER_AGENT = "OpenFrame-PackageSearch/1.0";

    private PackageSearchRestClientFactory() {
    }

    public static RestClient create(String baseUrl, Duration timeout) {
        int timeoutMs = (int) timeout.toMillis();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeoutMs);
        requestFactory.setReadTimeout(timeoutMs);
        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .build();
    }
}
