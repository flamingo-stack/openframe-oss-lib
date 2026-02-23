package com.openframe.gateway.service;

import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;

import static java.lang.String.format;

@Component
public class ToolApiKeyHeadersResolver {

    private static final String BEARER_TOKEN_TEMPLATE = "Bearer %s";

    public Map<String, String> resolve(IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        APIKeyType apiKeyType = credentials != null && credentials.getApiKey() != null
                ? credentials.getApiKey().getType()
                : APIKeyType.NONE;

        return switch (apiKeyType) {
            case HEADER -> {
                String keyName = credentials.getApiKey().getKeyName();
                String key = credentials.getApiKey().getKey();
                yield Collections.singletonMap(keyName, key);
            }
            case BEARER_TOKEN -> {
                String key = credentials.getApiKey().getKey();
                String authorisation = format(BEARER_TOKEN_TEMPLATE, key);
                yield Collections.singletonMap(HttpHeaders.AUTHORIZATION, authorisation);
            }
            default -> Collections.emptyMap();
        };
    }
}
