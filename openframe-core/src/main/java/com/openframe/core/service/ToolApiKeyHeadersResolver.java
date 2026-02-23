package com.openframe.core.service;

import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolCredentials;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static com.openframe.core.constants.HttpHeaders.AUTHORIZATION;

@Component
public class ToolApiKeyHeadersResolver {

    public Map<String, String> resolve(IntegratedTool tool) {
        ToolCredentials credentials = tool.getCredentials();
        APIKeyType apiKeyType = credentials != null && credentials.getApiKey() != null
                ? credentials.getApiKey().getType()
                : APIKeyType.NONE;

        switch (apiKeyType) {
            case HEADER:
                Map<String, String> headers = new HashMap<>();
                headers.put(credentials.getApiKey().getKeyName(), credentials.getApiKey().getKey());
                return headers;
            case BEARER_TOKEN:
                return Collections.singletonMap(AUTHORIZATION, "Bearer " + credentials.getApiKey().getKey());
            default:
                return Collections.emptyMap();
        }
    }
}
