package com.openframe.api.config;

import com.nimbusds.jose.EncryptionMethod;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWEAlgorithm;
import com.nimbusds.jose.JWEHeader;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSAEncrypter;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.EncryptedJWT;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.openframe.api.controller.UserController;
import com.openframe.api.service.user.UserService;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.unauthenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = UserController.class)
@ContextConfiguration(classes = {
        UserController.class,
        SecurityConfig.class,
        AuthenticationConfig.class,
        BaseGlobalExceptionHandler.class
})
class SecurityConfigTest {

    private static final String TRANSFER_PATH = "/users/user-2/transfer-ownership";
    private static final RSAKey UNKNOWN_KEY = generateUnknownKey();

    @MockBean
    private UserService userService;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void transferOwnership_ownerTokenSignedWithUnknownKey_transfersForTheCaller() throws Exception {
        mockMvc.perform(post(TRANSFER_PATH).header(HttpHeaders.AUTHORIZATION, bearer("OWNER", "ADMIN")))
                .andExpect(status().isNoContent());

        verify(userService).transferOwnership("user-2", "user-1");
    }

    @Test
    void transferOwnership_ownerToken_authenticatesWithScopesAndRoles() throws Exception {
        mockMvc.perform(post(TRANSFER_PATH).header(HttpHeaders.AUTHORIZATION, bearer("OWNER", "ADMIN")))
                .andExpect(authenticated()
                        .withAuthenticationName("owner@acme.example")
                        .withAuthorities(List.of(
                                authority("SCOPE_openid"), authority("SCOPE_profile"),
                                authority("OWNER"), authority("ADMIN"))));
    }

    @Test
    void transferOwnership_adminWithoutOwnerRole_isForbidden() throws Exception {
        mockMvc.perform(post(TRANSFER_PATH).header(HttpHeaders.AUTHORIZATION, bearer("ADMIN")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access denied"));

        verifyNoInteractions(userService);
    }

    @Test
    void transferOwnership_noToken_isUnauthorized() throws Exception {
        mockMvc.perform(post(TRANSFER_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("Access denied"));

        verifyNoInteractions(userService);
    }

    @Test
    void deleteUser_adminToken_actsAsTheUserInTheToken() throws Exception {
        mockMvc.perform(delete("/users/user-2").header(HttpHeaders.AUTHORIZATION, bearer("ADMIN")))
                .andExpect(status().isNoContent());

        verify(userService).softDeleteUser("user-2", "user-1");
    }

    @Test
    void listUsers_noToken_isServedAnonymously() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isOk())
                .andExpect(unauthenticated());

        verify(userService).listUsers(0, 20);
    }

    @ParameterizedTest
    @MethodSource("unreadableTokens")
    void listUsers_unreadableBearerToken_isUnauthorized(String token) throws Exception {
        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("error=\"invalid_token\"")));

        verifyNoInteractions(userService);
    }

    private static Stream<Arguments> unreadableTokens() {
        return Stream.of(
                arguments(Named.of("not a JWT", "not-a-jwt")),
                arguments(Named.of("claims not a JSON object", unsignedWithRawPayload("[\"user-1\"]"))),
                arguments(Named.of("no claims", unsignedWithRawPayload("{}"))),
                arguments(Named.of("encrypted", encrypted(new JWTClaimsSet.Builder()
                        .subject("owner@acme.example")
                        .build()))));
    }

    private static String bearer(String... roles) {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("https://another-platform.example")
                .subject("owner@acme.example")
                .claim("userId", "user-1")
                .claim("tenant_id", "tenant-1")
                .claim("scope", "openid profile")
                .claim("roles", List.of(roles))
                .expirationTime(new Date(0))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("unknown-key").build(), claims);
        try {
            jwt.sign(new RSASSASigner(UNKNOWN_KEY));
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot sign the test token", e);
        }
        return "Bearer " + jwt.serialize();
    }

    private static String encrypted(JWTClaimsSet claims) {
        EncryptedJWT jwt = new EncryptedJWT(new JWEHeader(JWEAlgorithm.RSA_OAEP_256, EncryptionMethod.A256GCM), claims);
        try {
            jwt.encrypt(new RSAEncrypter(UNKNOWN_KEY));
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot encrypt the test token", e);
        }
        return jwt.serialize();
    }

    private static String unsignedWithRawPayload(String payload) {
        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        return header + "." + encoder.encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".";
    }

    private static RSAKey generateUnknownKey() {
        try {
            return new RSAKeyGenerator(2048).keyID("unknown-key").generate();
        } catch (JOSEException e) {
            throw new IllegalStateException("Cannot generate the unknown test key", e);
        }
    }

    private static GrantedAuthority authority(String name) {
        return new SimpleGrantedAuthority(name);
    }
}
