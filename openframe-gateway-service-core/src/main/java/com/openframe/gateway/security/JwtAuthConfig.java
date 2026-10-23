package com.openframe.gateway.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import com.openframe.gateway.security.tenant.IssuerUrlProvider;
import com.openframe.security.jwt.JwtConfig;
import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtIssuerReactiveAuthenticationManagerResolver;
import org.springframework.security.oauth2.server.resource.authentication.JwtReactiveAuthenticationManager;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverter;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

import static org.springframework.security.oauth2.core.OAuth2TokenValidatorResult.success;


/**
 * Per-issuer JWT authentication for the gateway.
 * <p>
 * Nothing here may block a Netty event-loop thread: this gateway can be its own issuer's upstream
 * (the issuer host routes back through the load balancer to this pod), so a blocking discovery call
 * on an event loop can wait on itself and hang the pod for every tenant. Therefore:
 * <ul>
 *   <li>issuers this gateway doesn't accept are rejected before any cache entry or network call;</li>
 *   <li>issuer discovery and JWKS fetches are non-blocking and bounded by timeouts;</li>
 *   <li>an issuer whose discovery/JWKS fails is remembered briefly, so it can't cost an outbound
 *       call on every request.</li>
 * </ul>
 */
@Slf4j
@Configuration
public class JwtAuthConfig {

    @Value("${openframe.security.jwt.cache.expire-after}")
    private Duration expireAfter;

    @Value("${openframe.security.jwt.cache.refresh-after}")
    private Duration refreshAfter;

    @Value("${openframe.security.jwt.cache.maximum-size}")
    private long maximumSize;

    @Value("${openframe.security.jwt.discovery.connect-timeout:3s}")
    private Duration discoveryConnectTimeout;

    @Value("${openframe.security.jwt.discovery.response-timeout:5s}")
    private Duration discoveryResponseTimeout;

    @Value("${openframe.security.jwt.discovery.failure-ttl:30s}")
    private Duration discoveryFailureTtl;

    @Bean
    public LoadingCache<String, ReactiveAuthenticationManager> issuerManagersCache(
            ReactiveJwtAuthenticationConverter converter,
            JwtConfig jwtConfig,
            IssuerUrlProvider issuerUrlProvider) {

        WebClient discoveryClient = discoveryWebClient();

        // The loader only builds objects; discovery happens lazily and reactively on first decode.
        return Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(expireAfter)
                .refreshAfterWrite(refreshAfter)
                .build(issuer -> {
                    if (issuer.equals(jwtConfig.getIssuer())) {
                        var pub = jwtConfig.loadPublicKey();
                        var dec = NimbusReactiveJwtDecoder.withPublicKey(pub).build();
                        dec.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
                        var m = new JwtReactiveAuthenticationManager(dec);
                        m.setJwtAuthenticationConverter(converter);
                        return m;
                    }

                    var dec = NimbusReactiveJwtDecoder.withIssuerLocation(issuer)
                            .webClient(discoveryClient)
                            .build();

                    var defaultValidator = JwtValidators.createDefault();
                    var strictIssuerValidator = createStrictIssuerValidator(issuerUrlProvider);
                    dec.setJwtValidator(new DelegatingOAuth2TokenValidator<>(defaultValidator, strictIssuerValidator));

                    var jwtManager = new JwtReactiveAuthenticationManager(dec);
                    jwtManager.setJwtAuthenticationConverter(converter);
                    return jwtManager;
                });
    }

    private WebClient discoveryWebClient() {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, (int) discoveryConnectTimeout.toMillis())
                .responseTimeout(discoveryResponseTimeout);
        return WebClient.builder()
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    private OAuth2TokenValidator<Jwt> createStrictIssuerValidator(IssuerUrlProvider issuerUrlProvider) {
        return jwt -> {
            String iss = (jwt.getIssuer() != null ? jwt.getIssuer().toString() : null);
            if (issuerUrlProvider.accepts(iss)) {
                return success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error(OAuth2ErrorCodes.INVALID_TOKEN, "Unexpected issuer", null)
            );
        };
    }

    @Bean
    public JwtIssuerReactiveAuthenticationManagerResolver jwtIssuerAuthenticationManagerResolver(
            LoadingCache<String, ReactiveAuthenticationManager> issuerManagersCache,
            JwtConfig jwtConfig,
            IssuerUrlProvider issuerUrlProvider) {

        Cache<String, Boolean> unreachableIssuers = Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(discoveryFailureTtl)
                .build();

        return new JwtIssuerReactiveAuthenticationManagerResolver(issuer -> {
            // Empty makes Spring answer 401 "Invalid issuer"; checked first so an untrusted token
            // never reaches the cache or the network.
            if (!issuer.equals(jwtConfig.getIssuer()) && !issuerUrlProvider.accepts(issuer)) {
                return Mono.empty();
            }
            if (unreachableIssuers.getIfPresent(issuer) != null) {
                return Mono.error(new AuthenticationServiceException("JWT issuer is unreachable: " + issuer));
            }
            ReactiveAuthenticationManager manager = issuerManagersCache.get(issuer);
            // JwtReactiveAuthenticationManager maps bad tokens to InvalidBearerTokenException and
            // key-source failures (discovery/JWKS unreachable) to AuthenticationServiceException.
            return Mono.just(authentication -> manager.authenticate(authentication)
                    .doOnError(AuthenticationServiceException.class, e -> {
                        log.warn("JWT issuer {} unreachable, rejecting its tokens for {}: {}",
                                issuer, discoveryFailureTtl, e.getMessage());
                        unreachableIssuers.put(issuer, Boolean.TRUE);
                    }));
        });
    }
}
