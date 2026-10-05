package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.sso.SsoAlreadyLinkedException;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.document.tenant.TenantStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppleNativeDiscoveryControllerTest {

    @Mock
    private AppleNativeTokenVerifier verifier;
    @Mock
    private UserService userService;
    @Mock
    private TenantService tenantService;
    @Mock
    private TenantRegistrationService registrationService;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @InjectMocks
    private AppleNativeDiscoveryController controller;

    @BeforeEach
    void setUp() {
        lenient().when(ssoIdentityService.findLink(eq("apple"), anyMap())).thenReturn(Optional.empty());
    }

    private static Jwt identity(Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("id").header("alg", "RS256").subject("apple-sub");
        claims.forEach(builder::claim);
        return builder.build();
    }

    private static void assertStatus(Runnable call, HttpStatus status, String reason) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ResponseStatusException.class, e -> {
            assertThat(e.getStatusCode()).isEqualTo(status);
            if (reason != null) {
                assertThat(e.getReason()).isEqualTo(reason);
            }
        });
    }

    private static AppleNativeDiscoveryController.AppleNativeDiscoverRequest discover() {
        return new AppleNativeDiscoveryController.AppleNativeDiscoverRequest("id", "nonce");
    }

    @Test
    void shouldResolveTenantByLinkBeforeEmail() {
        when(verifier.verify("id", "nonce")).thenReturn(identity(Map.of("email", "relay@privaterelay.appleid.com")));
        when(ssoIdentityService.findLink(eq("apple"), anyMap())).thenReturn(Optional.of(SsoIdentity.builder().userId("u-1").build()));
        when(userService.findActiveById("u-1")).thenReturn(Optional.of(activeUser("u-1", "linked-tenant", "old@x.com")));
        when(tenantService.findById("linked-tenant")).thenReturn(Optional.of(tenant("linked-tenant", TenantStatus.ACTIVE)));

        assertThat(controller.discover(discover()).tenantId()).isEqualTo("linked-tenant");
        verify(userService, never()).findActiveByEmail(anyString());
    }

    @Test
    void shouldFallBackToVerifiedEmail() {
        when(verifier.verify("id", "nonce")).thenReturn(identity(Map.of("email", "Tim@Apple.com", "email_verified", "true")));
        when(userService.findActiveByEmail("tim@apple.com")).thenReturn(Optional.of(activeUser("u", "t", "tim@apple.com")));
        when(tenantService.findById("t")).thenReturn(Optional.of(tenant("t", TenantStatus.ACTIVE)));

        assertThat(controller.discover(discover()).tenantId()).isEqualTo("t");
    }

    @Test
    void shouldRejectInvalidTokenOrUnverifiedEmail() {
        when(verifier.verify(any(), any()))
                .thenThrow(new OAuth2AuthenticationException(new OAuth2Error("invalid_grant")))
                .thenReturn(identity(Map.of("email", "x@y.com", "email_verified", false)))
                .thenReturn(identity(Map.of()));

        assertStatus(() -> controller.discover(discover()), HttpStatus.UNAUTHORIZED, null);
        assertStatus(() -> controller.discover(discover()), HttpStatus.UNAUTHORIZED, null);
        assertStatus(() -> controller.discover(discover()), HttpStatus.UNAUTHORIZED, null);
        assertStatus(() -> controller.discover(new AppleNativeDiscoveryController.AppleNativeDiscoverRequest(" ", "n")),
                HttpStatus.BAD_REQUEST, null);
    }

    @Test
    void shouldSignalRegistrationRequiredOrInactiveAccount() {
        when(verifier.verify(any(), any())).thenReturn(identity(Map.of("email", "x@y.com")));
        when(userService.findActiveByEmail("x@y.com"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(activeUser("u", "t", "x@y.com")));
        when(tenantService.findById("t")).thenReturn(Optional.of(tenant("t", TenantStatus.INACTIVE)));

        assertStatus(() -> controller.discover(discover()), HttpStatus.NOT_FOUND, "registration_required");
        assertStatus(() -> controller.discover(discover()), HttpStatus.FORBIDDEN, "account_inactive");
    }

    private static AppleNativeDiscoveryController.AppleNativeRegisterRequest register(String domain) {
        return new AppleNativeDiscoveryController.AppleNativeRegisterRequest("id", "nonce", "NewCo", domain, "Tim", null);
    }

    @Test
    void shouldRegisterTenantForNewAppleIdentity() {
        when(verifier.verify("id", "nonce")).thenReturn(identity(Map.of("email", "Tim@NewCo.com", "email_verified", true)));
        when(userService.findActiveByEmail("tim@newco.com")).thenReturn(Optional.empty());
        when(registrationService.registerTenant(any())).thenReturn(tenant("newco", TenantStatus.ACTIVE));

        assertThat(controller.register(register("NEWCO")).tenantId()).isEqualTo("newco");
        ArgumentCaptor<TenantRegistrationRequest> reg = ArgumentCaptor.forClass(TenantRegistrationRequest.class);
        verify(registrationService).registerTenant(reg.capture());
        assertThat(reg.getValue().getTenantDomain()).isEqualTo("newco");
        assertThat(reg.getValue().getLastName()).isEmpty();
        assertThat(reg.getValue().isEmailPreVerified()).isTrue();
    }

    @Test
    void shouldRefuseRegistrationOfLinkedOrExistingAccount() {
        when(verifier.verify(any(), any())).thenReturn(identity(Map.of("email", "tim@newco.com")));
        doThrow(new SsoAlreadyLinkedException()).doNothing().when(ssoIdentityService).ensureNotAlreadyLinked(eq("apple"), anyMap());
        when(userService.findActiveByEmail("tim@newco.com")).thenReturn(Optional.of(activeUser("u", "t", "tim@newco.com")));

        assertStatus(() -> controller.register(register("newco")), HttpStatus.CONFLICT, "already_linked");
        assertStatus(() -> controller.register(register("newco")), HttpStatus.CONFLICT, "account_exists");
        verify(registrationService, never()).registerTenant(any());
    }

    @Test
    void shouldRequireRegistrationFields() {
        assertStatus(() -> controller.register(register(" ")), HttpStatus.BAD_REQUEST, null);
    }
}
