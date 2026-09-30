package com.openframe.gatewayauth;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Date;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.type;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = GatewayAuthSecurityConfigTest.CallerController.class)
@ContextConfiguration(classes = {GatewayAuthSecurityConfig.class, GatewayAuthSecurityConfigTest.CallerController.class})
class GatewayAuthSecurityConfigTest {

    private static final String OPEN_PATH = "/open";
    private static final String ADMIN_ONLY_PATH = "/admin-only";
    private static final Date EXPIRED_AT = new Date(1_577_836_800_000L);
    private static final RSAKey UNKNOWN_KEY = generateUnknownKey();

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest
    @MethodSource("callerTokens")
    void securityFilterChain_callerToken_grantsItsScopesAndBareRoles(JWTClaimsSet claims, List<String> authorities)
            throws Exception {
        mockMvc.perform(get(OPEN_PATH).header(HttpHeaders.AUTHORIZATION, bearer(claims)))
                .andExpect(authenticated().withAuthorities(AuthorityUtils.createAuthorityList(authorities)));
    }

    @Test
    void securityFilterChain_userToken_keepsTheJwtAsPrincipalNamedAfterTheSubject() throws Exception {
        String token = signed(claims().subject("user-1").claim("roles", List.of("ADMIN")).build());

        mockMvc.perform(get(OPEN_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(authenticated()
                        .withAuthenticationName("user-1")
                        .withAuthentication(authentication -> assertThat(authentication.getPrincipal())
                                .asInstanceOf(type(Jwt.class))
                                .returns("user-1", Jwt::getSubject)
                                .returns(token, Jwt::getTokenValue)));
    }

    @Test
    void securityFilterChain_noToken_servesTheRequestAnonymously() throws Exception {
        mockMvc.perform(get(OPEN_PATH))
                .andExpect(status().isOk())
                .andExpect(content().string("served"))
                .andExpect(unauthenticated());
    }

    @Test
    void securityFilterChain_unreadableBearerToken_isUnauthorized() throws Exception {
        mockMvc.perform(get(OPEN_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("error=\"invalid_token\"")))
                .andExpect(unauthenticated());
    }

    @Test
    void securityFilterChain_expiredAdminTokenSignedWithUnknownKey_passesTheRoleCheck() throws Exception {
        String admin = bearer(claims().subject("user-1").claim("roles", List.of("ADMIN")).build());

        mockMvc.perform(post(ADMIN_ONLY_PATH).header(HttpHeaders.AUTHORIZATION, admin))
                .andExpect(status().isOk())
                .andExpect(content().string("granted"));
    }

    @Test
    void securityFilterChain_deviceTokenOnAdminOnlyAction_isForbidden() throws Exception {
        String device = bearer(claims().subject("client-1").claim("roles", List.of("AGENT")).build());

        mockMvc.perform(post(ADMIN_ONLY_PATH).header(HttpHeaders.AUTHORIZATION, device))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access denied"));
    }

    @Test
    void securityFilterChain_noTokenOnAdminOnlyAction_isUnauthorized() throws Exception {
        mockMvc.perform(post(ADMIN_ONLY_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Access denied"));
    }

    private static Stream<Arguments> callerTokens() {
        return Stream.of(
                arguments(Named.of("owner", claims()
                                .subject("user-1")
                                .claim("tenant_id", "tenant-1")
                                .claim("scope", "openid profile")
                                .claim("roles", List.of("ADMIN", "OWNER"))
                                .build()),
                        List.of("SCOPE_openid", "SCOPE_profile", "ADMIN", "OWNER")),
                arguments(Named.of("device", claims()
                                .subject("client-1")
                                .claim("machine_id", "machine-1")
                                .claim("grant_type", "client_credentials")
                                .claim("roles", List.of("AGENT"))
                                .build()),
                        List.of("AGENT")),
                arguments(Named.of("no roles claim", claims().subject("user-1").claim("scope", "openid").build()),
                        List.of("SCOPE_openid")),
                arguments(Named.of("no roles nor scope", claims().subject("user-1").build()),
                        List.of()));
    }

    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder()
                .issuer("https://another-platform.example")
                .expirationTime(EXPIRED_AT);
    }

    private static String bearer(JWTClaimsSet claims) {
        return "Bearer " + signed(claims);
    }

    private static String signed(JWTClaimsSet claims) {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("unknown-key").build(), claims);
        try {
            jwt.sign(new RSASSASigner(UNKNOWN_KEY));
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot sign the test token", e);
        }
        return jwt.serialize();
    }

    private static RSAKey generateUnknownKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("unknown-key").generate();
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot generate the unknown test key", e);
        }
    }

    @RestController
    static class CallerController {

        @GetMapping(OPEN_PATH)
        String open() {
            return "served";
        }

        @PostMapping(ADMIN_ONLY_PATH)
        @PreAuthorize("hasAuthority('ADMIN')")
        String adminOnly() {
            return "granted";
        }
    }
}
