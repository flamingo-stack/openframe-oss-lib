package com.openframe.external.service;

import com.openframe.core.service.ProxyUrlResolver;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.data.service.ToolUrlService;
import com.openframe.external.exception.ToolProxyException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.ConnectTimeoutException;
import org.apache.hc.client5.http.classic.methods.*;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.Method;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static com.openframe.core.constants.HttpHeaders.*;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;

@Service
@Slf4j
public class RestProxyService {

    private static final String MASKED_VALUE = "****";

    static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(25);
    private static final String TOOLS_PREFIX = "/tools";

    private final IntegratedToolRepository toolRepository;
    private final ProxyUrlResolver proxyUrlResolver;
    private final ToolUrlService toolUrlService;
    private final FleetProxyGuard fleetProxyGuard;
    private final CloseableHttpClient httpClient;

    @Autowired
    public RestProxyService(IntegratedToolRepository toolRepository,
                           ProxyUrlResolver proxyUrlResolver,
                           ToolUrlService toolUrlService,
                           FleetProxyGuard fleetProxyGuard) {
        this(toolRepository, proxyUrlResolver, toolUrlService, fleetProxyGuard, CONNECT_TIMEOUT, RESPONSE_TIMEOUT);
    }

    RestProxyService(IntegratedToolRepository toolRepository,
                     ProxyUrlResolver proxyUrlResolver,
                     ToolUrlService toolUrlService,
                     FleetProxyGuard fleetProxyGuard,
                     Duration connectTimeout,
                     Duration responseTimeout) {
        this.toolRepository = toolRepository;
        this.proxyUrlResolver = proxyUrlResolver;
        this.toolUrlService = toolUrlService;
        this.fleetProxyGuard = fleetProxyGuard;
        this.httpClient = createHttpClient(connectTimeout, responseTimeout);
    }

    public ResponseEntity<String> proxyApiRequest(String toolId, HttpServletRequest request, String body) {
        log.info("Received proxy request for tool: {}, method: {}, path: {}", toolId, request.getMethod(), request.getRequestURI());

        Optional<String> fleetTenantId = fleetTenantId(toolId, request);

        Optional<IntegratedTool> toolOpt = toolRepository.findByKey(toolId);
        
        if (toolOpt.isEmpty()) {
            log.warn("Tool not found: {}", toolId);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tool not found: " + toolId);
        }
        
        IntegratedTool tool = toolOpt.get();
        log.info("Found tool: {} (enabled: {})", tool.getName(), tool.isEnabled());
        
        if (!tool.isEnabled()) {
            log.warn("Tool {} is not enabled", tool.getName());
            return ResponseEntity.badRequest().body("Tool " + tool.getName() + " is not enabled");
        }

        URI targetUri;
        try {
            URI originalUri = new URI(request.getRequestURL().toString());
            if (request.getQueryString() != null) {
                originalUri = new URI(originalUri + "?" + request.getQueryString());
            }
            log.info("Original URI: {}", originalUri);

            Optional<ToolUrl> optionalToolUrl = toolUrlService.getUrlByToolType(tool, ToolUrlType.API);
            if (optionalToolUrl.isEmpty()) {
                log.error("Tool URL not found for tool: {}", toolId);
                return ResponseEntity.badRequest().body("Tool URL not found for tool: " + toolId);
            }
            ToolUrl toolUrl = optionalToolUrl.get();
            log.info("Tool URL: {}", toolUrl.getUrl());

            targetUri = proxyUrlResolver.resolvePreservingEncoding(toolId, toolUrl.getUrl(), toolUrl.getPort(), originalUri, TOOLS_PREFIX);
            log.info("Target URI resolved to: {}", targetUri);
        } catch (URISyntaxException e) {
            log.error("Invalid URI syntax for tool: {}", toolId, e);
            return ResponseEntity.badRequest().body("Invalid URI: " + e.getMessage());
        } catch (Exception e) {
            log.error("Error proxying request for tool: {}", toolId, e);
            return ResponseEntity.internalServerError().body("Internal server error: " + e.getMessage());
        }

        Map<String, String> headers = buildApiRequestHeaders(tool);
        fleetTenantId.ifPresent(tenantId -> headers.put(X_TENANT_ID, tenantId));
        return proxy(tool, targetUri, request.getMethod(), headers, body);
    }

    private Optional<String> fleetTenantId(String toolId, HttpServletRequest request) {
        if (!fleetProxyGuard.appliesTo(toolId)) {
            return Optional.empty();
        }
        fleetProxyGuard.requireAllowed(request.getMethod(), toolPath(toolId, request.getRequestURI()));
        return Optional.of(fleetProxyGuard.tenantId());
    }

    private static String toolPath(String toolId, String requestUri) {
        String toolRoot = TOOLS_PREFIX + "/" + toolId;
        int start = requestUri.indexOf(toolRoot);
        String path = start < 0 ? requestUri : requestUri.substring(start + toolRoot.length());
        return path.isEmpty() ? "/" : path;
    }

    Map<String, String> buildApiRequestHeaders(IntegratedTool tool) {
        Map<String, String> headers = new HashMap<>();
        headers.put(ACCEPT_CHARSET, "UTF-8");
        headers.put(ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        headers.put(CONTENT_TYPE, APPLICATION_JSON);
        headers.put(ACCEPT, APPLICATION_JSON);

        CredentialHeader credential = credentialHeader(tool.getCredentials());
        if (credential != null) {
            headers.put(credential.name(), credential.value());
        }
        
        return headers;
    }

    private ResponseEntity<String> proxy(IntegratedTool tool, URI targetUri, String method, 
                                       Map<String, String> proxyHeaders, String body) {
        log.info("Starting proxy request to {} - method: {}, URI: {}", tool.getName(), method, targetUri);
        
        try {
            HttpUriRequestBase httpRequest = createHttpRequest(method, targetUri);
            log.debug("Created HTTP request: {} {}", method, targetUri);

            proxyHeaders.forEach(httpRequest::setHeader);
            if (log.isDebugEnabled()) {
                log.debug("Headers: {}", maskCredential(proxyHeaders, tool.getCredentials()));
            }

            if (isNotEmpty(body)) {
                log.debug("Setting request body (length: {})", body.length());
                StringEntity entity = new StringEntity(body, ContentType.APPLICATION_JSON);
                httpRequest.setEntity(entity);
            }
            
            log.info("Executing HTTP request to {}", targetUri);

            return httpClient.execute(httpRequest, response -> {
                int statusCode = response.getCode();
                HttpEntity entity = response.getEntity();
                String responseBody = entity != null ? EntityUtils.toString(entity) : "";
                
                log.info("Successfully proxied request to {} - status: {}, response length: {}",
                        tool.getName(), statusCode, responseBody.length());

                ResponseEntity.BodyBuilder builder = ResponseEntity.status(statusCode);
                Header contentType = response.getFirstHeader(CONTENT_TYPE);
                if (contentType != null) {
                    builder.header(CONTENT_TYPE, contentType.getValue());
                }
                return builder.body(responseBody);
            });
            
        } catch (ConnectTimeoutException e) {
            log.error("Timed out connecting to {} at {}: {}", tool.getName(), targetUri, e.getMessage(), e);
            throw ToolProxyException.unreachable(tool.getKey(), e);
        } catch (SocketTimeoutException e) {
            log.error("Timed out waiting for {} at {}: {}", tool.getName(), targetUri, e.getMessage(), e);
            throw ToolProxyException.timeout(tool.getKey(), e);
        } catch (IOException e) {
            log.error("IOException while proxying request to {} at {}: {}", tool.getName(), targetUri, e.getMessage(), e);
            throw ToolProxyException.unreachable(tool.getKey(), e);
        } catch (Exception e) {
            log.error("Unexpected error proxying request to {} at {}: {}", tool.getName(), targetUri, e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Unexpected error: " + e.getMessage());
        }
    }

    Map<String, String> maskCredential(Map<String, String> headers, ToolCredentials credentials) {
        CredentialHeader credential = credentialHeader(credentials);
        if (credential == null) {
            return headers;
        }
        Map<String, String> masked = new HashMap<>();
        headers.forEach((name, value) -> masked.put(name, name.equalsIgnoreCase(credential.name()) ? MASKED_VALUE : value));
        return masked;
    }

    private CredentialHeader credentialHeader(ToolCredentials credentials) {
        if (credentials == null || credentials.getApiKey() == null || credentials.getApiKey().getType() == null) {
            return null;
        }
        ToolApiKey apiKey = credentials.getApiKey();
        return switch (apiKey.getType()) {
            case HEADER -> new CredentialHeader(apiKey.getKeyName(), apiKey.getKey());
            case BEARER_TOKEN -> new CredentialHeader(AUTHORIZATION, "Bearer " + apiKey.getKey());
            case NONE -> null;
        };
    }

    private record CredentialHeader(String name, String value) {
    }

    private HttpUriRequestBase createHttpRequest(String method, URI uri) {
        try {
            Method httpMethod = Method.valueOf(method.toUpperCase(Locale.ROOT));
            return switch (httpMethod) {
                case GET -> new HttpGet(uri);
                case HEAD -> new HttpHead(uri);
                case POST -> new HttpPost(uri);
                case PUT -> new HttpPut(uri);
                case PATCH -> new HttpPatch(uri);
                case DELETE -> new HttpDelete(uri);
                case OPTIONS -> new HttpOptions(uri);
                default -> throw new IllegalArgumentException("Unsupported HTTP method: " + method);
            };
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Unsupported HTTP method: " + method, e);
        }
    }

    private static CloseableHttpClient createHttpClient(Duration connectTimeout, Duration responseTimeout) {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(10))
                .setResponseTimeout(Timeout.of(responseTimeout))
                .build();
        ConnectionConfig connectionConfig = ConnectionConfig.custom()
                .setConnectTimeout(Timeout.of(connectTimeout))
                .build();

        return HttpClients.custom()
                .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                        .setDefaultConnectionConfig(connectionConfig)
                        .build())
                .setDefaultRequestConfig(requestConfig)
                .build();
    }
} 
