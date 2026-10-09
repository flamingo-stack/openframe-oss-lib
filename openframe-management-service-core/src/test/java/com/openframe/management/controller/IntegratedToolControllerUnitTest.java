package com.openframe.management.controller;

import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.debezium.service.DebeziumService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The tenant chart re-registers its tools on every Argo sync with a payload that never carries the API key,
 * so a re-registration must not wipe the key the setup scheduler minted.
 */
@ExtendWith(MockitoExtension.class)
class IntegratedToolControllerUnitTest {

    private static final String KEY = "fleetmdm-server";

    @Mock
    private IntegratedToolService toolService;
    @Mock
    private DebeziumService debeziumService;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private IntegratedToolController controller;

    @BeforeEach
    void setUp() {
        controller = new IntegratedToolController(toolService, debeziumService, tenantIdProvider, List.of());
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-1");
        when(toolService.saveTool(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("re-registering without an API key keeps the stored one")
    void reRegistrationKeepsStoredApiKey() {
        ToolApiKey stored = apiKey("minted-token");
        when(toolService.getToolByKey(KEY)).thenReturn(Optional.of(tool("existing-id", credentials(stored))));

        controller.saveTool(KEY, request(tool(KEY, credentials(null))));

        IntegratedTool saved = savedTool();
        assertThat(saved.getId()).isEqualTo("existing-id");
        assertThat(saved.getCredentials().getUsername()).isEqualTo("admin@example.com");
        assertThat(saved.getCredentials().getApiKey()).isSameAs(stored);
    }

    @Test
    @DisplayName("re-registering without credentials at all keeps the stored API key")
    void reRegistrationWithoutCredentialsKeepsStoredApiKey() {
        ToolApiKey stored = apiKey("minted-token");
        when(toolService.getToolByKey(KEY)).thenReturn(Optional.of(tool("existing-id", credentials(stored))));

        controller.saveTool(KEY, request(tool(KEY, null)));

        assertThat(savedTool().getCredentials().getApiKey()).isSameAs(stored);
    }

    @Test
    @DisplayName("an API key in the request replaces the stored one")
    void requestApiKeyWins() {
        when(toolService.getToolByKey(KEY)).thenReturn(Optional.of(tool("existing-id", credentials(apiKey("old-token")))));
        ToolApiKey rotated = apiKey("new-token");

        controller.saveTool(KEY, request(tool(KEY, credentials(rotated))));

        assertThat(savedTool().getCredentials().getApiKey()).isSameAs(rotated);
    }

    @Test
    @DisplayName("a first registration is saved as sent, with a fresh id")
    void firstRegistrationSavedAsSent() {
        when(toolService.getToolByKey(KEY)).thenReturn(Optional.empty());

        controller.saveTool(KEY, request(tool(KEY, credentials(null))));

        IntegratedTool saved = savedTool();
        assertThat(saved.getId()).isNull();
        assertThat(saved.getCredentials().getApiKey()).isNull();
    }

    private IntegratedTool savedTool() {
        ArgumentCaptor<IntegratedTool> captor = ArgumentCaptor.forClass(IntegratedTool.class);
        verify(toolService).saveTool(captor.capture());
        return captor.getValue();
    }

    private static IntegratedToolController.SaveToolRequest request(IntegratedTool tool) {
        IntegratedToolController.SaveToolRequest request = new IntegratedToolController.SaveToolRequest();
        request.setTool(tool);
        return request;
    }

    private static IntegratedTool tool(String id, ToolCredentials credentials) {
        return IntegratedTool.builder().id(id).key(KEY).credentials(credentials).build();
    }

    private static ToolCredentials credentials(ToolApiKey apiKey) {
        ToolCredentials credentials = new ToolCredentials();
        credentials.setUsername("admin@example.com");
        credentials.setPassword("secret");
        credentials.setApiKey(apiKey);
        return credentials;
    }

    private static ToolApiKey apiKey(String value) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey(value);
        apiKey.setType(APIKeyType.BEARER_TOKEN);
        apiKey.setKeyName("Fleet API Token");
        return apiKey;
    }
}
