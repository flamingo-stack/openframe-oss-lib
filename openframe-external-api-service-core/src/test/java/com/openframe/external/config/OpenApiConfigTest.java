package com.openframe.external.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springdoc.core.customizers.GlobalOpenApiCustomizer;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.util.AntPathMatcher;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpenApiConfigTest {

    private static final String SCHEME = "ApiKeyAuth";
    private static final Map<String, String> COMMON_RESPONSES = Map.of(
            "400", "Invalid request parameters, body or cursor",
            "401", "Unauthorized - invalid or missing API key",
            "429", "Rate limit exceeded - see the X-RateLimit-* headers",
            "500", "Internal server error");

    private final OpenApiConfig config = new OpenApiConfig();

    @Test
    void infoNamesTheApiWithASemanticVersion() {
        Info info = config.openAPI().getInfo();

        assertEquals("OpenFrame External API", info.getTitle());
        assertTrue(info.getVersion().matches("\\d+\\.\\d+\\.\\d+"), "not a semantic version: " + info.getVersion());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Devices", "Customers", "Tickets", "Knowledge Base", "Logs", "Tools"})
    void descriptionListsEveryResource(String resource) {
        assertTrue(config.openAPI().getInfo().getDescription().contains("**" + resource + "**"));
    }

    @Test
    void descriptionExplainsAuthenticationRateLimitsAndErrors() {
        String description = config.openAPI().getInfo().getDescription();

        assertTrue(description.contains("## Authentication"));
        assertTrue(description.contains("`X-API-Key`"));
        assertTrue(description.contains("## Rate Limiting"));
        assertTrue(description.contains("X-RateLimit-Remaining-Minute"));
        assertTrue(description.contains("## Error Handling"));
        for (String status : List.of("200", "400", "401", "403", "429", "500")) {
            assertTrue(description.contains("`" + status + "`"), "status " + status + " is not documented");
        }
    }

    @Test
    void infoCarriesContactAndLicense() {
        Info info = config.openAPI().getInfo();

        assertEquals("OpenFrame Team", info.getContact().getName());
        assertEquals("support@openframe.com", info.getContact().getEmail());
        assertEquals("https://docs.openframe.com", info.getContact().getUrl());
        assertEquals("MIT", info.getLicense().getName());
        assertEquals("https://opensource.org/licenses/MIT", info.getLicense().getUrl());
    }

    @Test
    void singleServerPointsAtTheGatewayPrefix() {
        OpenAPI openApi = config.openAPI();

        assertEquals(1, openApi.getServers().size());
        assertEquals("/external-api", openApi.getServers().get(0).getUrl());
    }

    @Test
    void apiKeyIsSentInTheApiKeyHeader() {
        SecurityScheme scheme = config.openAPI().getComponents().getSecuritySchemes().get(SCHEME);

        assertNotNull(scheme);
        assertEquals(SecurityScheme.Type.APIKEY, scheme.getType());
        assertEquals(SecurityScheme.In.HEADER, scheme.getIn());
        assertEquals("X-API-Key", scheme.getName());
        assertTrue(scheme.getDescription().contains("ak_keyId.sk_secretKey"));
    }

    @Test
    void everyOperationRequiresTheDeclaredApiKeyScheme() {
        OpenAPI openApi = config.openAPI();
        List<SecurityRequirement> security = openApi.getSecurity();

        assertEquals(1, security.size());
        assertEquals(Set.of(SCHEME), security.get(0).keySet());
        assertTrue(security.get(0).get(SCHEME).isEmpty());
        assertTrue(openApi.getComponents().getSecuritySchemes().keySet().containsAll(security.get(0).keySet()));
    }

    @Test
    void groupIsNamedExternalApi() {
        assertEquals("external-api", config.externalApiGroup().getGroup());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/devices",
            "/api/v1/customers/cust-1",
            "/api/v1/knowledge-base/items/item-1/attachments",
            "/tools/tactical-rmm/api/agents",
            "/test/ping"
    })
    void groupIncludesExternalApiPaths(String path) {
        assertTrue(isInGroup(path));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/actuator/health", "/api/core/users", "/api/v2/devices", "/internal/devices", "/api/v10/devices"})
    void groupLeavesOutEverythingElse(String path) {
        assertFalse(isInGroup(path));
    }

    @Test
    void groupDeclaresItsIncludeAndExcludePatterns() {
        GroupedOpenApi group = config.externalApiGroup();

        assertEquals(List.of("/tools/**", "/test/**", "/api/v1/**"), group.getPathsToMatch());
        assertEquals(List.of("/actuator/**", "/api/core/**"), group.getPathsToExclude());
    }

    @Test
    void commonResponsesAreAddedToAnOperationThatDeclaresNone() {
        Operation operation = operation();

        customise(new Paths().addPathItem("/api/v1/devices", new PathItem().get(operation)));

        assertEquals(COMMON_RESPONSES.keySet(), operation.getResponses().keySet());
        COMMON_RESPONSES.forEach((code, description) ->
                assertEquals(description, operation.getResponses().get(code).getDescription()));
    }

    @Test
    void responsesDeclaredByTheOperationAreKept() {
        ApiResponse ok = new ApiResponse().description("Device page");
        ApiResponse ownBadRequest = new ApiResponse().description("Unknown device status filter");
        ApiResponse notFound = new ApiResponse().description("Device not found");
        Operation operation = operation();
        operation.getResponses()
                .addApiResponse("200", ok)
                .addApiResponse("400", ownBadRequest)
                .addApiResponse("404", notFound);

        customise(new Paths().addPathItem("/api/v1/devices/{id}", new PathItem().get(operation)));

        ApiResponses responses = operation.getResponses();
        assertEquals(Set.of("200", "400", "401", "404", "429", "500"), responses.keySet());
        assertSame(ok, responses.get("200"));
        assertSame(ownBadRequest, responses.get("400"));
        assertSame(notFound, responses.get("404"));
        assertEquals(COMMON_RESPONSES.get("401"), responses.get("401").getDescription());
        assertEquals(COMMON_RESPONSES.get("429"), responses.get("429").getDescription());
        assertEquals(COMMON_RESPONSES.get("500"), responses.get("500").getDescription());
    }

    @Test
    void operationThatDeclaresEveryCommonResponseIsLeftUntouched() {
        Operation operation = operation();
        COMMON_RESPONSES.keySet().forEach(code ->
                operation.getResponses().addApiResponse(code, new ApiResponse().description("own " + code)));

        customise(new Paths().addPathItem("/api/v1/devices", new PathItem().get(operation)));

        assertEquals(COMMON_RESPONSES.keySet(), operation.getResponses().keySet());
        COMMON_RESPONSES.keySet().forEach(code ->
                assertEquals("own " + code, operation.getResponses().get(code).getDescription()));
    }

    @Test
    void forbiddenIsNotDeclaredForEveryOperation() {
        Operation operation = operation();

        customise(new Paths().addPathItem("/api/v1/devices", new PathItem().get(operation)));

        assertFalse(operation.getResponses().containsKey("403"));
    }

    @Test
    void everyOperationOfEveryPathIsCustomised() {
        Operation list = operation();
        Operation create = operation();
        Operation update = operation();
        Operation delete = operation();
        Operation patch = operation();
        Paths paths = new Paths()
                .addPathItem("/api/v1/customers", new PathItem().get(list).post(create))
                .addPathItem("/api/v1/customers/{id}", new PathItem().put(update).delete(delete).patch(patch));

        customise(paths);

        for (Operation operation : List.of(list, create, update, delete, patch)) {
            assertEquals(COMMON_RESPONSES.keySet(), operation.getResponses().keySet());
        }
    }

    @Test
    void operationsDoNotShareResponseInstances() {
        Operation first = operation();
        Operation second = operation();

        customise(new Paths().addPathItem("/api/v1/customers", new PathItem().get(first).post(second)));

        first.getResponses().get("400").setDescription("changed on one operation");
        assertEquals(COMMON_RESPONSES.get("400"), second.getResponses().get("400").getDescription());
    }

    @Test
    void apiWithoutOperationsIsLeftAlone() {
        assertDoesNotThrow(() -> customise(new Paths()));
        assertDoesNotThrow(() -> customise(new Paths().addPathItem("/api/v1/empty", new PathItem())));
    }

    private boolean isInGroup(String path) {
        GroupedOpenApi group = config.externalApiGroup();
        AntPathMatcher matcher = new AntPathMatcher();
        return group.getPathsToMatch().stream().anyMatch(pattern -> matcher.match(pattern, path))
                && group.getPathsToExclude().stream().noneMatch(pattern -> matcher.match(pattern, path));
    }

    @Test
    void commonResponsesCustomizerIsGlobalSoGroupedDocsGetItToo() {
        assertInstanceOf(GlobalOpenApiCustomizer.class, config.commonResponsesCustomizer());
    }

    private void customise(Paths paths) {
        OpenApiCustomizer customizer = config.commonResponsesCustomizer();
        customizer.customise(new OpenAPI().paths(paths));
    }

    private static Operation operation() {
        return new Operation().responses(new ApiResponses());
    }
}
