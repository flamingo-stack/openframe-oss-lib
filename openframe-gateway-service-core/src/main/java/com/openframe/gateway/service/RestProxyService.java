package com.openframe.gateway.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.reactive.repository.tool.ReactiveIntegratedToolRepository;
import com.openframe.gateway.config.CurlLoggingHandler;
import com.openframe.gateway.upstream.ToolUpstreamResolverRegistry;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import io.netty.util.AttributeKey;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import javax.net.ssl.SSLException;
import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static com.openframe.core.constants.HttpHeaders.*;
import static org.apache.commons.lang3.StringUtils.isNotBlank;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class RestProxyService {

    private static final AttributeKey<URI> TARGET_URI_KEY = AttributeKey.valueOf("target_uri");

    private final ReactiveIntegratedToolRepository toolRepository;
    private final ToolUpstreamResolverRegistry upstreamRegistry;
    private final ToolApiKeyHeadersResolver apiKeyHeadersResolver;
    private final AgentDeviceAccessValidator agentDeviceAccessValidator;

    public Mono<ResponseEntity<String>> proxyApiRequest(String toolId, ServerHttpRequest request, String body) {
        return toolRepository.findById(toolId)
                .flatMap(tool -> {
                    if (!tool.isEnabled()) {
                        return Mono
                                .just(ResponseEntity.badRequest().body("Tool " + tool.getName() + " is not enabled"));
                    }

                    URI targetUri = upstreamRegistry.resolve(toolId).resolveRest(tool, request, "/tools");
                    log.debug("Proxying api request for tool: {}, url: {}", toolId, targetUri);

                    HttpMethod method = request.getMethod();
                    Map<String, String> headers = buildApiRequestHeaders(tool);

                    return proxy(tool, targetUri, method, headers, body);
                })
                .switchIfEmpty(
                        Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tool not found: " + toolId)));
    }

    private Map<String, String> buildApiRequestHeaders(IntegratedTool tool) {
        Map<String, String> headers = new HashMap<>();
        headers.put(ACCEPT_CHARSET, "UTF-8");
        headers.put(ACCEPT_LANGUAGE, "en-US,en;q=0.9");
        headers.put(CONTENT_TYPE, APPLICATION_JSON);
        headers.put(ACCEPT, APPLICATION_JSON);
        headers.putAll(apiKeyHeadersResolver.resolve(tool));
        return headers;
    }

    public Mono<ResponseEntity<String>> proxyAgentRequest(
            String toolId, ServerHttpRequest request, String body, String jwtMachineId) {
        String agentToolId = extractAgentToolId(toolId, request).orElse(null);
        return agentDeviceAccessValidator.canAccess(jwtMachineId, agentToolId)
                .flatMap(allowed -> {
                    if (!allowed) {
                        log.warn("Blocked agent request: machineId={} to agentToolId={} via tool={}",
                                jwtMachineId, agentToolId, toolId);
                        return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .<String>build());
                    }
                    return toolRepository.findById(toolId)
                            .flatMap(tool -> {
                                if (!tool.isEnabled()) {
                                    ResponseEntity<String> response = ResponseEntity.badRequest()
                                            .body("Tool " + tool.getName() + " is not enabled");
                                    return Mono.just(response);
                                }

                                URI targetUri = upstreamRegistry.resolve(toolId)
                                        .resolveRest(tool, request, "/tools/agent");
                                log.debug("Proxying agent request for tool: {}, url: {}", toolId, targetUri);

                                HttpMethod method = request.getMethod();
                                Map<String, String> headers = buildAgentRequestHeaders(request);

                                return proxy(tool, targetUri, method, headers, body);
                            })
                            .switchIfEmpty(Mono.just(
                                    ResponseEntity.status(HttpStatus.NOT_FOUND).body("Tool not found: " + toolId)));
                });
    }

    private java.util.Optional<String> extractAgentToolId(String toolId, ServerHttpRequest request) {
        String path = request.getPath().value();
        String prefix = "/tools/agent/" + toolId + "/";
        if (!path.startsWith(prefix)) {
            return java.util.Optional.empty();
        }
        String remaining = path.substring(prefix.length());
        if (remaining.isBlank()) {
            return java.util.Optional.empty();
        }
        int slashIdx = remaining.indexOf('/');
        String agentToolId = slashIdx == -1 ? remaining : remaining.substring(0, slashIdx);
        return agentToolId.isBlank() ? java.util.Optional.empty() : java.util.Optional.of(agentToolId);
    }

    private Map<String, String> buildAgentRequestHeaders(ServerHttpRequest request) {
        Map<String, String> headers = new HashMap<>();
        headers.put(ACCEPT, APPLICATION_JSON);
        headers.put(CONTENT_TYPE, APPLICATION_JSON);

        HttpHeaders requestHeaders = request.getHeaders();
        String toolAuthorisation = requestHeaders.getFirst("Tool-Authorization");
        if (isNotBlank(toolAuthorisation)) {
            headers.put(AUTHORIZATION, toolAuthorisation);
        }
        return headers;
    }

    private Mono<ResponseEntity<String>> proxy(
            IntegratedTool tool,
            URI targetUri,
            HttpMethod method,
            Map<String, String> proxyHeaders,
            String body) {
        HttpClient httpClient = buildHttpClient(targetUri);
        
        WebClient webClient = WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .codecs(configurer -> configurer
                        .defaultCodecs()
                        .maxInMemorySize(16 * 1024 * 1024)) // Increase to 16MB
                .build();
                
        WebClient.RequestBodySpec requestSpec = webClient
                .method(method)
                .uri(targetUri)
                .headers(headers -> headers.setAll(proxyHeaders));

        if (isNotEmpty(body)) {
            requestSpec.bodyValue(body);
        }

        Mono<ResponseEntity<String>> monoResponseEntity;
        try {
            monoResponseEntity = requestSpec
                    .retrieve()
                    .onStatus(this::isErrorStatusCode, this::processErrorResponse)
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(60))
                    .map(ResponseEntity::ok)
                    .onErrorResume(this::buildErrorResponse)
                    .doOnSuccess(response -> log.debug("Successfully proxied request to {}", tool.getName()))
                    .doOnError(error -> log.error("Failed to proxy request to {}: {}", tool.getName(),
                            error.getMessage()));
        } catch (Exception e) {
            log.error("Failed to proxy request to {}: {}", tool.getName(), e.getMessage());
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage()));
        }
        return monoResponseEntity;
    }

    private HttpClient buildHttpClient(URI targetUri) {
        return HttpClient.create()
                .responseTimeout(Duration.ofSeconds(60))
                .option(io.netty.channel.ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
                .option(io.netty.channel.ChannelOption.SO_LINGER, 0)
                .option(io.netty.channel.ChannelOption.TCP_NODELAY, true)
                // Configure decoder for larger responses
                .httpResponseDecoder(spec -> spec
                        .maxHeaderSize(16384)
                        .maxInitialLineLength(16384))
                .secure(sslSpec -> {
                    try {
                        sslSpec.sslContext(io.netty.handler.ssl.SslContextBuilder.forClient()
                                .trustManager(InsecureTrustManagerFactory.INSTANCE)
                                .build());
                    } catch (SSLException e) {
                        log.error("Error configuring SSL context: {}", e.getMessage());
                    }
                })
                .doOnConnected(conn -> {
                    conn.channel().attr(TARGET_URI_KEY).set(targetUri);
                    conn.addHandlerFirst("curl-logger", new CurlLoggingHandler());
                });
    }

    private boolean isErrorStatusCode(HttpStatusCode statusCode) {
        return statusCode.is4xxClientError() || statusCode.is5xxServerError();
    }

    private Mono<Throwable> processErrorResponse(ClientResponse response) {
        return response.bodyToMono(String.class)
                .flatMap(errorBody -> Mono.error(
                        WebClientResponseException.create(
                                response.statusCode().value(),
                                response.statusCode().toString(),
                                response.headers().asHttpHeaders(),
                                errorBody.getBytes(),
                                null)));
    }

    private Mono<ResponseEntity<String>> buildErrorResponse(Throwable e) {
        if (e instanceof WebClientResponseException responseException) {
            ResponseEntity<String> response = ResponseEntity.status(responseException.getStatusCode())
                    .body(responseException.getResponseBodyAsString());
            return Mono.just(response);
        }
        ResponseEntity<String> response = ResponseEntity.status(500).body(e.getMessage());
        return Mono.just(response);
    }
}
