package com.openframe.external.mapper;

import com.openframe.api.dto.tool.ToolFilters;
import com.openframe.api.dto.tool.ToolList;
import com.openframe.data.document.apikey.APIKeyType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.external.dto.tool.ToolApiKeyResponse;
import com.openframe.external.dto.tool.ToolCredentialsResponse;
import com.openframe.external.dto.tool.ToolFilterResponse;
import com.openframe.external.dto.tool.ToolResponse;
import com.openframe.external.dto.tool.ToolUrlResponse;
import com.openframe.external.dto.tool.ToolsResponse;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ToolMapperTest {

    private final ToolMapper mapper = new ToolMapper();

    @Test
    void toolMapsEveryScalarField() {
        IntegratedTool tool = IntegratedTool.builder()
                .id("tool-1")
                .tenantId("tenant-1")
                .key("tactical-rmm")
                .name("Tactical RMM")
                .description("Remote monitoring")
                .icon("tactical.svg")
                .type("RMM")
                .toolType("TACTICAL_RMM")
                .category("Monitoring")
                .platformCategory("Integrated")
                .enabled(true)
                .layer("Application")
                .layerOrder(3)
                .layerColor("#FF0000")
                .metricsPath("/metrics")
                .healthCheckEndpoint("/health")
                .healthCheckInterval(30)
                .connectionTimeout(5000)
                .readTimeout(10000)
                .allowedEndpoints(new String[]{"/api/agents", "/api/clients"})
                .build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals("tool-1", response.getId());
        assertEquals("Tactical RMM", response.getName());
        assertEquals("Remote monitoring", response.getDescription());
        assertEquals("tactical.svg", response.getIcon());
        assertEquals("RMM", response.getType());
        assertEquals("TACTICAL_RMM", response.getToolType());
        assertEquals("Monitoring", response.getCategory());
        assertEquals("Integrated", response.getPlatformCategory());
        assertTrue(response.getEnabled());
        assertEquals("Application", response.getLayer());
        assertEquals(3, response.getLayerOrder());
        assertEquals("#FF0000", response.getLayerColor());
        assertEquals("/metrics", response.getMetricsPath());
        assertEquals("/health", response.getHealthCheckEndpoint());
        assertEquals(30, response.getHealthCheckInterval());
        assertEquals(5000, response.getConnectionTimeout());
        assertEquals(10000, response.getReadTimeout());
        assertEquals(List.of("/api/agents", "/api/clients"), response.getAllowedEndpoints());
    }

    @Test
    void toolUrlsMapUrlPortAndTypeName() {
        IntegratedTool tool = IntegratedTool.builder()
                .toolUrls(List.of(
                        new ToolUrl("https://rmm.example.com", "8443", ToolUrlType.DASHBOARD),
                        new ToolUrl("http://rmm-api", "8000", ToolUrlType.API)))
                .build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals(List.of(
                new ToolUrlResponse("https://rmm.example.com", "8443", "DASHBOARD"),
                new ToolUrlResponse("http://rmm-api", "8000", "API")), response.getToolUrls());
    }

    @Test
    void toolUrlWithoutTypeAndNullUrlEntryAreTolerated() {
        IntegratedTool tool = IntegratedTool.builder()
                .toolUrls(Arrays.asList(new ToolUrl("http://rmm-api", null, null), null))
                .build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals(Arrays.asList(new ToolUrlResponse("http://rmm-api", null, null), null), response.getToolUrls());
    }

    @Test
    void credentialsMapUsernamePasswordAndApiKey() {
        IntegratedTool tool = IntegratedTool.builder()
                .credentials(credentials("admin", "pa55", apiKey("s3cr3t", APIKeyType.HEADER, "X-Auth-Token")))
                .build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals(new ToolCredentialsResponse("admin", "pa55",
                new ToolApiKeyResponse("s3cr3t", "HEADER", "X-Auth-Token")), response.getCredentials());
    }

    @Test
    void credentialsWithoutApiKeyKeepNullApiKey() {
        IntegratedTool tool = IntegratedTool.builder().credentials(credentials("admin", "pa55", null)).build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals(new ToolCredentialsResponse("admin", "pa55", null), response.getCredentials());
    }

    @Test
    void apiKeyWithoutTypeKeepsNullType() {
        IntegratedTool tool = IntegratedTool.builder()
                .credentials(credentials(null, null, apiKey("s3cr3t", null, null)))
                .build();

        ToolResponse response = mapper.toToolResponse(tool);

        assertEquals(new ToolApiKeyResponse("s3cr3t", null, null), response.getCredentials().apiKey());
    }

    @Test
    void emptyToolMapsToNullNestedObjectsAndDisabled() {
        ToolResponse response = mapper.toToolResponse(new IntegratedTool());

        assertNull(response.getId());
        assertNull(response.getToolUrls());
        assertNull(response.getCredentials());
        assertNull(response.getAllowedEndpoints());
        assertFalse(response.getEnabled());
    }

    @Test
    void nullToolMapsToNull() {
        assertNull(mapper.toToolResponse(null));
    }

    @Test
    void toolListMapsToolsInOrder() {
        ToolList list = ToolList.builder()
                .tools(List.of(
                        IntegratedTool.builder().id("tool-1").name("Tactical RMM").build(),
                        IntegratedTool.builder().id("tool-2").name("MeshCentral").build()))
                .build();

        ToolsResponse response = mapper.toToolsResponse(list);

        assertEquals(List.of("tool-1", "tool-2"), response.getTools().stream().map(ToolResponse::getId).toList());
        assertEquals(List.of("Tactical RMM", "MeshCentral"), response.getTools().stream().map(ToolResponse::getName).toList());
    }

    @Test
    void emptyToolListMapsToEmptyTools() {
        ToolsResponse response = mapper.toToolsResponse(ToolList.builder().tools(List.of()).build());

        assertTrue(response.getTools().isEmpty());
    }

    @Test
    void nullToolListMapsToEmptyTools() {
        ToolsResponse response = mapper.toToolsResponse(null);

        assertTrue(response.getTools().isEmpty());
    }

    @Test
    void filtersMapTypesCategoriesAndPlatformCategories() {
        ToolFilters filters = ToolFilters.builder()
                .types(List.of("RMM", "MDM"))
                .categories(List.of("Monitoring"))
                .platformCategories(List.of("Integrated", "Datasource"))
                .build();

        ToolFilterResponse response = mapper.toToolFilterResponse(filters);

        assertEquals(new ToolFilterResponse(
                List.of("RMM", "MDM"), List.of("Monitoring"), List.of("Integrated", "Datasource")), response);
    }

    @Test
    void nullFiltersMapToEmptyLists() {
        ToolFilterResponse response = mapper.toToolFilterResponse(null);

        assertEquals(new ToolFilterResponse(List.of(), List.of(), List.of()), response);
    }

    private static ToolCredentials credentials(String username, String password, ToolApiKey apiKey) {
        ToolCredentials credentials = new ToolCredentials();
        credentials.setUsername(username);
        credentials.setPassword(password);
        credentials.setApiKey(apiKey);
        return credentials;
    }

    private static ToolApiKey apiKey(String key, APIKeyType type, String keyName) {
        ToolApiKey apiKey = new ToolApiKey();
        apiKey.setKey(key);
        apiKey.setType(type);
        apiKey.setKeyName(keyName);
        return apiKey;
    }
}
