package com.openframe.security.oauth.service;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import com.openframe.security.jwt.JwtService;
import com.openframe.security.oauth.dto.OAuthCallbackResult;
import com.openframe.security.oauth.dto.TokenResponse;
import com.openframe.security.oauth.exception.AppleNativeRegistrationRequiredException;
import com.openframe.security.oauth.headers.ForwardedHeadersContributor;
import com.openframe.security.oauth.service.redirect.RedirectTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OAuthBffServiceFlowTest {

    private static final String AUTHORIZE_URL = "https://auth.example.com/sas";
    private static final String AUTH_SERVER = "http://auth-server:9013";
    private static final String TOKENS_JSON = "{\"access_token\":\"%s\",\"refresh_token\":\"rt\",\"token_type\":\"Bearer\",\"expires_in\":300}";

    @Mock
    private RedirectTargetResolver redirectTargetResolver;
    @Mock
    private ForwardedHeadersContributor headersContributor;
    @Mock
    private MongoOAuth2AuthorizationRepository authorizationRepository;

    private JwtService jwtService;
    private NimbusJwtEncoder stateEncoder;
    private final List<ClientRequest> sent = new ArrayList<>();
    private HttpStatus replyStatus = HttpStatus.OK;
    private String replyBody = TOKENS_JSON.formatted("header.e30.sig");

    @BeforeEach
    void setUp() throws Exception {
        RSAKey key = new RSAKeyGenerator(2048).keyID("state").generate();
        stateEncoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
        jwtService = new JwtService(stateEncoder,
                NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey()).build());
        lenient().when(redirectTargetResolver.resolve(anyString(), any(), any(), any()))
                .thenAnswer(inv -> Mono.just("https://" + inv.getArgument(0) + ".openframe.ai/"));
    }

    private OAuthBffService service() {
        WebClient.Builder builder = WebClient.builder().exchangeFunction(request -> {
            sent.add(request);
            return Mono.just(ClientResponse.create(replyStatus).header("Content-Type", "application/json").body(replyBody).build());
        });
        OAuthBffService service = new OAuthBffService(builder, redirectTargetResolver, headersContributor, jwtService, authorizationRepository);
        ReflectionTestUtils.setField(service, "authServerUrl", AUTH_SERVER);
        ReflectionTestUtils.setField(service, "authUrl", AUTHORIZE_URL);
        ReflectionTestUtils.setField(service, "clientId", "bff-client");
        ReflectionTestUtils.setField(service, "clientSecret", "bff-secret");
        ReflectionTestUtils.setField(service, "redirectUri", "https://app.openframe.ai/oauth/callback");
        return service;
    }

    private static ServerHttpRequest get(String path) {
        return MockServerHttpRequest.get(path).build();
    }

    private static UriComponents parse(String url) {
        return UriComponentsBuilder.fromUriString(url).build();
    }

    // --- authorize redirect ---

    @Test
    void shouldBuildPkceAuthorizeRedirectForTenant() {
        OAuthBffService.AuthorizeData data = service().buildAuthorizeRedirect("acme", "/devices", "google", false, get("/oauth/login")).block();

        UriComponents url = parse(data.authorizeUrl());
        assertThat(data.authorizeUrl()).startsWith(AUTHORIZE_URL + "/acme/oauth2/authorize?");
        assertThat(url.getQueryParams().getFirst("response_type")).isEqualTo("code");
        assertThat(url.getQueryParams().getFirst("client_id")).isEqualTo("bff-client");
        assertThat(url.getQueryParams().getFirst("code_challenge_method")).isEqualTo("S256");
        assertThat(url.getQueryParams().getFirst("state")).isEqualTo(data.state());
        assertThat(url.getQueryParams().getFirst("provider")).isEqualTo("google");
        assertThat(URLDecoder.decode(url.getQueryParams().getFirst("redirect_uri"), StandardCharsets.UTF_8))
                .isEqualTo("https://app.openframe.ai/oauth/callback");
        assertThat(url.getQueryParams().getFirst("code_challenge")).isNotEqualTo(data.codeVerifier()).hasSize(43);
        assertThat(data.redirectTo()).isEqualTo("/devices");
        assertThat(data.tenantId()).isEqualTo("acme");
    }

    @Test
    void shouldUseFreshStateAndVerifierEveryTime() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData first = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        OAuthBffService.AuthorizeData second = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();

        assertThat(first.state()).isNotEqualTo(second.state());
        assertThat(first.codeVerifier()).isNotEqualTo(second.codeVerifier());
        assertThat(first.authorizeUrl()).doesNotContain("provider=");
    }

    @Test
    void shouldFallBackToRefererWhenNoRedirectRequested() {
        ServerHttpRequest request = MockServerHttpRequest.get("/oauth/login").header(HttpHeaders.REFERER, "https://acme.openframe.ai/tickets").build();

        assertThat(service().buildAuthorizeRedirect("acme", null, null, false, request).block().redirectTo())
                .isEqualTo("https://acme.openframe.ai/tickets");
    }

    @ParameterizedTest
    @ValueSource(strings = {"//evil.com/x", "/\\evil.com", "javascript:alert(1)", "data:text/html,x", "evil.com", "relative/path"})
    void shouldNotCarryUnsafeRedirects(String redirectTo) {
        assertThat(service().buildAuthorizeRedirect("acme", redirectTo, null, false, get("/")).block().redirectTo()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/", "/devices?id=1", "https://acme.openframe.ai/x", "com.openframe.app://auth"})
    void shouldCarrySafeRelativeAndAbsoluteRedirects(String redirectTo) {
        assertThat(service().buildAuthorizeRedirect("acme", redirectTo, null, false, get("/")).block().redirectTo()).isEqualTo(redirectTo);
    }

    // --- state cookie + callback ---

    private ServerHttpRequest callbackWith(OAuthBffService.AuthorizeData data, String cookieValue) {
        return MockServerHttpRequest.get("/oauth/callback").cookie(new HttpCookie("of_oauth_" + data.state(), cookieValue)).build();
    }

    @Test
    void shouldExchangeCodeWithVerifierAndResolveTarget() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData data = service.buildAuthorizeRedirect("acme", "/devices", null, true, get("/")).block();
        String userToken = new PlainJWT(new JWTClaimsSet.Builder().claim("userId", "user-7").build()).serialize();
        replyBody = TOKENS_JSON.formatted(userToken);

        OAuthCallbackResult result = service.handleCallback("code-1", data.state(),
                callbackWith(data, service.buildStateJwt(data, 180))).block();

        assertThat(result.tenantId()).isEqualTo("acme");
        assertThat(result.authMobile()).isTrue();
        assertThat(result.tokens().refresh_token()).isEqualTo("rt");
        assertThat(result.redirectTo()).isEqualTo("https://acme.openframe.ai/");
        assertThat(sent).singleElement().satisfies(req -> {
            assertThat(req.url().toString()).isEqualTo(AUTH_SERVER + "/acme/oauth2/token");
            assertThat(req.headers().getFirst(HttpHeaders.AUTHORIZATION)).startsWith("Basic ");
        });
        verify(redirectTargetResolver).resolve(eq("acme"), eq("user-7"), eq("/devices"), any());
    }

    @Test
    void shouldRejectCallbackWithoutStateCookie() {
        OAuthBffService service = service();

        StepVerifier.create(service.handleCallback("code", "some-state", get("/oauth/callback")))
                .expectErrorMessage("Authentication session expired. Please try again.")
                .verify();
        assertThat(sent).isEmpty();
    }

    @Test
    void shouldRejectCookieIssuedForAnotherState() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData mine = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        OAuthBffService.AuthorizeData other = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        ServerHttpRequest request = callbackWith(mine, service.buildStateJwt(other, 180));

        StepVerifier.create(service.handleCallback("code", mine.state(), request)).expectError(IllegalStateException.class).verify();
        assertThat(sent).isEmpty();
    }

    @Test
    void shouldRejectForgedOrExpiredStateCookie() throws Exception {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData data = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        RSAKey attackerKey = new RSAKeyGenerator(2048).generate();
        String forged = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(attackerKey)))
                .encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(JwtClaimsSet.builder()
                        .claim("s", data.state()).claim("cv", "attacker-verifier").claim("tid", "victim-tenant")
                        .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build())).getTokenValue();

        StepVerifier.create(service.handleCallback("code", data.state(), callbackWith(data, forged)))
                .expectError(IllegalStateException.class).verify();
        String expired = stateEncoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(JwtClaimsSet.builder()
                .claim("s", data.state()).claim("cv", data.codeVerifier()).claim("tid", "acme")
                .issuedAt(Instant.now().minusSeconds(600)).expiresAt(Instant.now().minusSeconds(300)).build())).getTokenValue();
        StepVerifier.create(service.handleCallback("code", data.state(), callbackWith(data, expired)))
                .expectError(IllegalStateException.class).verify();
        assertThat(sent).isEmpty();
    }

    @Test
    void shouldDropUnsafeRedirectSmuggledIntoStateCookie() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData data = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        OAuthBffService.AuthorizeData tampered = new OAuthBffService.AuthorizeData(
                data.authorizeUrl(), data.state(), data.codeVerifier(), "acme", "//evil.com", false);

        service.handleCallback("code", data.state(), callbackWith(data, service.buildStateJwt(tampered, 180))).block();

        verify(redirectTargetResolver).resolve(eq("acme"), any(), eq(null), any());
    }

    @Test
    void shouldFailWithGenericMessageWhenCodeExchangeIsRejected() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData data = service.buildAuthorizeRedirect("acme", null, null, false, get("/")).block();
        replyStatus = HttpStatus.BAD_REQUEST;
        replyBody = "{\"error\":\"invalid_grant\",\"error_description\":\"code reused\"}";

        StepVerifier.create(service.handleCallback("used-code", data.state(), callbackWith(data, service.buildStateJwt(data, 180))))
                .expectErrorMessage("Authentication failed. Please try again.")
                .verify();
        verify(redirectTargetResolver, never()).resolve(any(), any(), any(), any());
    }

    @Test
    void shouldCarryTenantVerifierRedirectAndMobileFlagInStateJwt() {
        OAuthBffService service = service();
        OAuthBffService.AuthorizeData data = service.buildAuthorizeRedirect("acme", "/x", null, true, get("/")).block();

        var jwt = jwtService.decodeToken(service.buildStateJwt(data, 180));

        assertThat(jwt.getClaimAsString("s")).isEqualTo(data.state());
        assertThat(jwt.getClaimAsString("cv")).isEqualTo(data.codeVerifier());
        assertThat(jwt.getClaimAsString("tid")).isEqualTo("acme");
        assertThat(jwt.getClaimAsString("rt")).isEqualTo("/x");
        assertThat(jwt.getClaimAsBoolean("am")).isTrue();
        assertThat(jwt.getExpiresAt()).isBefore(Instant.now().plusSeconds(181));
    }

    // --- refresh by lookup, logout ---

    private void storedAuthorizationWithUri(String authorizationUri) {
        MongoOAuth2Authorization auth = new MongoOAuth2Authorization();
        auth.setArAuthorizationUri(authorizationUri);
        when(authorizationRepository.findByRefreshTokenValue("rt")).thenReturn(Optional.of(auth));
    }

    @Test
    void shouldRefreshAtTenantTakenFromStoredAuthorizationUri() {
        storedAuthorizationWithUri("https://auth.example.com/sas/acme/oauth2/authorize");

        StepVerifier.create(service().refreshTokensByLookup("rt", get("/"))).expectNextCount(1).verifyComplete();
        assertThat(sent).singleElement().satisfies(req -> assertThat(req.url().toString()).isEqualTo(AUTH_SERVER + "/acme/oauth2/token"));
    }

    @Test
    void shouldSupportLegacyAuthorizationUriWithoutSasPrefix() {
        storedAuthorizationWithUri("https://auth.example.com/legacy-tenant/oauth2/authorize");

        service().refreshTokensByLookup("rt", get("/")).block();

        assertThat(sent.get(0).url().toString()).isEqualTo(AUTH_SERVER + "/legacy-tenant/oauth2/token");
    }

    @Test
    void shouldReturnEmptyForUnknownOrBlankRefreshToken() {
        when(authorizationRepository.findByRefreshTokenValue("unknown")).thenReturn(Optional.empty());

        StepVerifier.create(service().refreshTokensByLookup("unknown", get("/"))).verifyComplete();
        StepVerifier.create(service().refreshTokensByLookup(" ", get("/"))).verifyComplete();
        assertThat(sent).isEmpty();
    }

    @Test
    void shouldRevokeRefreshTokenAndSwallowFailures() {
        OAuthBffService service = service();
        replyStatus = HttpStatus.INTERNAL_SERVER_ERROR;

        StepVerifier.create(service.revokeRefreshToken("acme", "rt")).verifyComplete();
        StepVerifier.create(service.revokeRefreshToken("acme", null)).verifyComplete();

        assertThat(sent).singleElement().satisfies(req -> assertThat(req.url().toString()).isEqualTo(AUTH_SERVER + "/acme/oauth2/revoke"));
    }

    @Test
    void shouldRevokeByLookupAtStoredTenant() {
        storedAuthorizationWithUri("https://auth.example.com/sas/acme/oauth2/authorize");
        replyBody = "";

        StepVerifier.create(service().revokeRefreshTokenByLookup("rt")).verifyComplete();

        assertThat(sent.get(0).url().toString()).isEqualTo(AUTH_SERVER + "/acme/oauth2/revoke");
    }

    // --- mobile: apple native + signup ticket ---

    @Test
    void shouldSignalRegistrationRequiredWhenAppleDiscoveryFindsNoAccount() {
        replyStatus = HttpStatus.NOT_FOUND;
        replyBody = "{\"message\":\"registration_required\"}";

        StepVerifier.create(service().appleNativeDiscoverTenant("id-token", "nonce", get("/")))
                .expectError(AppleNativeRegistrationRequiredException.class).verify();
        assertThat(sent.get(0).url().toString()).isEqualTo(AUTH_SERVER + "/oauth/apple/native/discover");
    }

    @Test
    void shouldMapOtherAppleDiscoveryFailuresToGenericError() {
        replyStatus = HttpStatus.UNAUTHORIZED;

        StepVerifier.create(service().appleNativeDiscoverTenant("id-token", null, get("/")))
                .expectErrorMessage("Apple sign-in failed. Please try again.").verify();
    }

    @Test
    void shouldReturnDiscoveredAppleTenant() {
        replyBody = "{\"tenantId\":\"acme\"}";

        StepVerifier.create(service().appleNativeDiscoverTenant("id-token", "n", get("/"))).expectNext("acme").verifyComplete();
    }

    @Test
    void shouldSurfaceAuthServerMessageWhenAppleRegistrationIsRejected() {
        replyStatus = HttpStatus.CONFLICT;
        replyBody = "{\"message\":\"account_exists\"}";

        StepVerifier.create(service().appleNativeRegisterTenant("id", "n", "NewCo", "newco", null, null, get("/")))
                .expectErrorSatisfies(e -> assertThat(e).isInstanceOf(IllegalArgumentException.class).hasMessage("account_exists"))
                .verify();
    }

    @Test
    void shouldExchangeAppleIdentityAtTenantTokenEndpoint() {
        StepVerifier.create(service().appleNativeExchange("acme", "id", "code", "n", "Tim", null, get("/")))
                .expectNextCount(1).verifyComplete();
        assertThat(sent.get(0).url().toString()).isEqualTo(AUTH_SERVER + "/acme/oauth2/token");
    }

    @Test
    void shouldMapRejectedAppleExchangeToGenericError() {
        replyStatus = HttpStatus.BAD_REQUEST;

        StepVerifier.create(service().appleNativeExchange("acme", "id", "code", "n", null, null, get("/")))
                .expectErrorMessage("Apple sign-in failed. Please try again.").verify();
    }

    @Test
    void shouldCompleteSignupThenMintWithTicketGrant() {
        OAuthBffService service = new OAuthBffService(WebClient.builder().exchangeFunction(request -> {
            sent.add(request);
            String body = request.url().getPath().endsWith("/oauth/login/sso/complete")
                    ? "{\"tenantId\":\"newco\"}" : TOKENS_JSON.formatted("h.e30.s");
            return Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", "application/json").body(body).build());
        }), redirectTargetResolver, headersContributor, jwtService, authorizationRepository);
        ReflectionTestUtils.setField(service, "authServerUrl", AUTH_SERVER);
        ReflectionTestUtils.setField(service, "clientId", "bff-client");
        ReflectionTestUtils.setField(service, "clientSecret", "bff-secret");

        TokenResponse tokens = service.completeSignupTicket("tk", "NewCo", "newco", null, get("/")).block();

        assertThat(tokens.refresh_token()).isEqualTo("rt");
        assertThat(sent).extracting(req -> req.url().toString())
                .containsExactly(AUTH_SERVER + "/oauth/login/sso/complete", AUTH_SERVER + "/newco/oauth2/token");
    }

    @Test
    void shouldReportSignupCompletionRejectionMessage() {
        replyStatus = HttpStatus.CONFLICT;
        replyBody = "{\"message\":\"already_linked\"}";

        StepVerifier.create(service().completeSignupTicket("tk", "NewCo", "newco", null, get("/")))
                .expectErrorSatisfies(e -> assertThat(e).isInstanceOf(IllegalArgumentException.class).hasMessage("already_linked"))
                .verify();
    }
}
