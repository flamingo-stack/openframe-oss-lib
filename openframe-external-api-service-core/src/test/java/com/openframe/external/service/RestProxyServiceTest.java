package com.openframe.external.service;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static com.openframe.core.constants.HttpHeaders.ACCEPT;
import static com.openframe.core.constants.HttpHeaders.ACCEPT_CHARSET;
import static com.openframe.core.constants.HttpHeaders.ACCEPT_LANGUAGE;
import static com.openframe.core.constants.HttpHeaders.APPLICATION_JSON;
import static com.openframe.core.constants.HttpHeaders.AUTHORIZATION;
import static com.openframe.core.constants.HttpHeaders.CONTENT_TYPE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;

@ExtendWith(MockitoExtension.class)
class RestProxyServiceTest {

    private static final String KEY = "s3cr3t-api-key";
    private static final String MASKED = "****";

    @Mock
    private IntegratedToolRepository toolRepository;

    @Mock
    private ProxyUrlResolver proxyUrlResolver;

    @Mock
    private ToolUrlService toolUrlService;

    @InjectMocks
    private RestProxyService service;

    @Test
    void bearerTokenGoesToAuthorizationAndIsMaskedThere() {
        IntegratedTool tool = tool(APIKeyType.BEARER_TOKEN, null);

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals("Bearer " + KEY, headers.get(AUTHORIZATION));
        assertEquals(MASKED, masked.get(AUTHORIZATION));
        assertBoilerplateUntouched(masked);
        assertEquals(headers.size(), masked.size());
    }

    @Test
    void headerKeyGoesUnderItsConfiguredNameAndIsMaskedThere() {
        IntegratedTool tool = tool(APIKeyType.HEADER, "X-Auth-Token");

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(KEY, headers.get("X-Auth-Token"));
        assertEquals(MASKED, masked.get("X-Auth-Token"));
        assertFalse(masked.containsKey(AUTHORIZATION));
        assertBoilerplateUntouched(masked);
        assertEquals(headers.size(), masked.size());
    }

    @Test
    void maskingIsByHeaderNameNotByValue() {
        IntegratedTool tool = tool(APIKeyType.BEARER_TOKEN, null);
        Map<String, String> headers = Map.of(AUTHORIZATION, "Basic dXNlcjpzM2NyM3Q=", ACCEPT, APPLICATION_JSON);

        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(MASKED, masked.get(AUTHORIZATION));
        assertEquals(APPLICATION_JSON, masked.get(ACCEPT));
    }

    @Test
    void headerNameMatchIgnoresCase() {
        IntegratedTool tool = tool(APIKeyType.HEADER, "x-api-key");
        Map<String, String> headers = Map.of("X-API-KEY", KEY);

        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(MASKED, masked.get("X-API-KEY"));
    }

    @Test
    void noCredentialsAddsNothingAndMasksNothing() {
        IntegratedTool tool = IntegratedTool.builder().build();

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(4, headers.size());
        assertFalse(headers.containsKey(AUTHORIZATION));
        assertSame(headers, masked);
    }

    @Test
    void noneTypeAddsNothingAndMasksNothing() {
        IntegratedTool tool = tool(APIKeyType.NONE, null);

        Map<String, String> headers = service.buildApiRequestHeaders(tool);
        Map<String, String> masked = service.maskCredential(headers, tool.getCredentials());

        assertEquals(4, headers.size());
        assertSame(headers, masked);
    }

    private static IntegratedTool tool(APIKeyType type, String keyName) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setType(type);
        apiKey.setKey(KEY);
        apiKey.setKeyName(keyName);
        ToolCredentials credentials = new ToolCredentials();
        credentials.setApiKey(apiKey);
        return IntegratedTool.builder().credentials(credentials).build();
    }

    private static void assertBoilerplateUntouched(Map<String, String> headers) {
        assertEquals("UTF-8", headers.get(ACCEPT_CHARSET));
        assertEquals("en-US,en;q=0.9", headers.get(ACCEPT_LANGUAGE));
        assertEquals(APPLICATION_JSON, headers.get(CONTENT_TYPE));
        assertEquals(APPLICATION_JSON, headers.get(ACCEPT));
    }
}
