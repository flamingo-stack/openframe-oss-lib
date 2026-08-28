package com.openframe.external.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.responses.ApiResponse;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY;

/**
 * OpenAPI/Swagger configuration for OpenFrame External API
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("OpenFrame External API")
                .description("""
                    # OpenFrame External API
                    
                    This API provides programmatic access to OpenFrame platform functionality using API keys.
                    
                    ## Resources
                    
                    - **Devices** – list, filter, inspect, update status/nickname
                    - **Customers** – full CRUD incl. archiving
                    - **Tickets** – list, create, update, transition, assign, tag and annotate tickets (SaaS deployments)
                    - **Logs** / **Tools** – read access and integration proxying
                    
                    ## Authentication
                    
                    All endpoints require authentication using an API key. Include your API key in the `X-API-Key` header:
                    
                    ```
                    X-API-Key: ak_your_key_id.sk_your_secret_key
                    ```
                    
                    ## Rate Limiting
                    
                    API requests are rate-limited based on your API key configuration:
                    - **Per Minute**: 100 requests (default)
                    - **Per Hour**: 1,000 requests (default)
                    - **Per Day**: 10,000 requests (default)
                    
                    Rate limit headers are included in all responses:
                    - `X-RateLimit-Limit-Minute`: Maximum requests per minute
                    - `X-RateLimit-Remaining-Minute`: Remaining requests this minute
                    - `X-RateLimit-Limit-Hour`: Maximum requests per hour
                    - `X-RateLimit-Remaining-Hour`: Remaining requests this hour
                    
                    ## Error Handling
                    
                    The API uses standard HTTP status codes:
                    - `200` - Success
                    - `400` - Bad Request
                    - `401` - Unauthorized (invalid or missing API key)
                    - `403` - Forbidden (valid API key but insufficient permissions)
                    - `429` - Too Many Requests (rate limit exceeded)
                    - `500` - Internal Server Error
                    """)
                .version("1.1.0")
                .contact(new Contact()
                    .name("OpenFrame Team")
                    .email("support@openframe.com")
                    .url("https://docs.openframe.com"))
                .license(new License()
                    .name("MIT")
                    .url("https://opensource.org/licenses/MIT")))
            .servers(List.of(
                new Server()
                        .url("/external-api")
                    .description("Kubernetes Gateway server")
            ))
            .addSecurityItem(new SecurityRequirement()
                .addList("ApiKeyAuth"))
            .components(new io.swagger.v3.oas.models.Components()
                .addSecuritySchemes("ApiKeyAuth", new SecurityScheme()
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER)
                    .name(X_API_KEY)
                    .description("API key for authentication (format: ak_keyId.sk_secretKey)")));
    }

    @Bean
    public GroupedOpenApi externalApiGroup() {
        return GroupedOpenApi.builder()
                .group("external-api")
                .pathsToMatch("/tools/**", "/test/**", "/api/v1/**")
                .pathsToExclude("/actuator/**", "/api/core/**")
                .build();
    }

    /**
     * Responses every endpoint shares (gateway auth, rate limiting, server errors) are declared
     * once here instead of being copy-pasted onto each operation.
     */
    @Bean
    public OpenApiCustomizer commonResponsesCustomizer() {
        return openApi -> openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
            var responses = operation.getResponses();
            responses.computeIfAbsent("400", code -> new ApiResponse().description("Invalid request parameters, body or cursor"));
            responses.computeIfAbsent("401", code -> new ApiResponse().description("Unauthorized - invalid or missing API key"));
            responses.computeIfAbsent("429", code -> new ApiResponse().description("Rate limit exceeded - see the X-RateLimit-* headers"));
            responses.computeIfAbsent("500", code -> new ApiResponse().description("Internal server error"));
        }));
    }
}
