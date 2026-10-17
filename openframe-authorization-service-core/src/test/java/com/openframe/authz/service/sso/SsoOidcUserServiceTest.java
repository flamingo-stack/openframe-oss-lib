package com.openframe.authz.service.sso;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.document.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SsoOidcUserServiceTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private SSOConfigService ssoConfigService;
    @Mock
    private UserService userService;
    @Mock
    private GlobalDomainPolicyLookup globalDomainPolicyLookup;
    @Mock
    private RegistrationProcessor registrationProcessor;
    @InjectMocks
    private SsoOidcUserService service;

    private final OidcUser newcomer = oidcUser(Map.of("email", "New@Acme.com", "given_name", "New", "family_name", "Person"));
    private final AuthUser created = activeUser("user-new", TENANT, "new@acme.com");

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    private static SSOPerTenantConfig tenantApp(boolean enabled, boolean autoProvision, List<String> domains) {
        SSOPerTenantConfig cfg = new SSOPerTenantConfig();
        cfg.setEnabled(enabled);
        cfg.setAutoProvisionUsers(autoProvision);
        cfg.setAllowedDomains(domains);
        return cfg;
    }

    private void provisionDuringLogin(String provider, OidcUser user) {
        TenantContext.setTenantId(TENANT);
        service.autoProvisionForTenantLogin(authentication(provider, user));
    }

    @Test
    void shouldProvisionWhenTenantAppAllowsTheDomainCaseInsensitively() {
        when(ssoConfigService.getSSOConfig(TENANT, "google"))
                .thenReturn(Optional.of(tenantApp(true, true, List.of("ACME.com"))));
        when(userService.findActiveByEmailAndTenant("new@acme.com", TENANT)).thenReturn(Optional.empty());
        when(userService.registerOrReactivateFromSso(eq(TENANT), eq("New@Acme.com"), eq("New"), eq("Person"),
                eq(List.of(UserRole.ADMIN)), eq("google"))).thenReturn(created);

        provisionDuringLogin("google", newcomer);

        verify(registrationProcessor).postProcessAutoProvision(created, null);
    }

    @Test
    void shouldNotProvisionWhenAutoProvisionIsOffOrDomainNotAllowedOrListEmpty() {
        when(ssoConfigService.getSSOConfig(TENANT, "google")).thenReturn(
                Optional.of(tenantApp(true, false, List.of("acme.com"))),
                Optional.of(tenantApp(true, true, List.of("other.com"))),
                Optional.of(tenantApp(true, true, List.of())));

        provisionDuringLogin("google", newcomer);
        provisionDuringLogin("google", newcomer);
        provisionDuringLogin("google", newcomer);

        verify(userService, never()).registerOrReactivateFromSso(any(), any(), any(), any(), anyList(), any());
    }

    @Test
    void shouldProvisionByGlobalPolicyOnlyIntoTheMappedTenant() {
        when(ssoConfigService.getSSOConfig(anyString(), anyString())).thenReturn(Optional.empty());
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.of("another-tenant"));

        provisionDuringLogin("google", newcomer);

        verify(userService, never()).registerOrReactivateFromSso(any(), any(), any(), any(), anyList(), any());
    }

    @Test
    void shouldRefuseDuplicateActiveAccountInAnotherTenant() {
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.of(TENANT));
        when(userService.findActiveByEmailAndTenant("new@acme.com", TENANT)).thenReturn(Optional.empty());
        when(userService.hasActiveAccountInAnotherTenant("new@acme.com", TENANT)).thenReturn(true);

        assertThatThrownBy(() -> service.autoProvisionByGlobalDomain("google", newcomer))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("different organization");
        verify(userService, never()).registerOrReactivateFromSso(any(), any(), any(), any(), anyList(), any());
    }

    @Test
    void shouldFailLoginWhenProvisioningFails() {
        when(ssoConfigService.getSSOConfig(TENANT, "google")).thenThrow(new IllegalStateException("db down"));

        assertThatThrownBy(() -> provisionDuringLogin("google", newcomer)).hasMessage("db down");
    }

    @Test
    void shouldNotFailLoginWhenOnlyPostProcessingFails() {
        when(ssoConfigService.getSSOConfig(TENANT, "google"))
                .thenReturn(Optional.of(tenantApp(true, true, List.of("acme.com"))));
        AuthUser existing = activeUser("user-1", TENANT, "new@acme.com");
        when(userService.findActiveByEmailAndTenant("new@acme.com", TENANT)).thenReturn(Optional.of(existing));
        doThrow(new IllegalStateException("avatar down")).when(registrationProcessor).postProcessAutoProvision(existing, null);

        assertThatCode(() -> provisionDuringLogin("google", newcomer)).doesNotThrowAnyException();
    }

    @Test
    void shouldSkipProvisioningWithoutTenantOrEmail() {
        service.autoProvisionForTenantLogin(authentication("google", newcomer));
        provisionDuringLogin("google", oidcUser(Map.of()));

        verifyNoInteractions(ssoConfigService, userService);
    }

    @Test
    void shouldReuseExistingActiveUserOnGlobalPolicyProvision() {
        AuthUser existing = activeUser("user-1", TENANT, "new@acme.com");
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.of(TENANT));
        when(userService.findActiveByEmailAndTenant("new@acme.com", TENANT)).thenReturn(Optional.of(existing));

        assertThat(service.autoProvisionByGlobalDomain("google", newcomer)).contains(existing);
        verify(userService, never()).registerOrReactivateFromSso(any(), any(), any(), any(), anyList(), any());
    }

    @Test
    void shouldResolveProvisionTenantWithoutCreatingAnything() {
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.of(TENANT));

        assertThat(service.autoProvisionTenantForDomain("Someone@ACME.com")).contains(TENANT);
        assertThat(service.autoProvisionTenantForDomain(" ")).isEmpty();
        verifyNoInteractions(userService);
    }

    @Test
    void shouldUseLastAtSignForDomain() {
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.empty());

        service.autoProvisionTenantForDomain("\"weird@evil.com\"@acme.com");

        verify(globalDomainPolicyLookup).findTenantIdByDomainIfAutoAllowed("acme.com");
    }

    @Test
    void shouldReturnExistingUserFromResolveOrProvision() {
        AuthUser existing = activeUser("user-1", TENANT, "a@acme.com");
        when(userService.findActiveByEmailAndTenant("a@acme.com", TENANT)).thenReturn(Optional.of(existing));

        assertThat(service.resolveOrProvision(TENANT, "apple", " A@Acme.com ", "A", "B")).contains(existing);
    }

    @Test
    void shouldProvisionFromResolveOrProvisionOnlyWhenTenantAppAllows() {
        when(userService.findActiveByEmailAndTenant("a@acme.com", TENANT)).thenReturn(Optional.empty());
        when(ssoConfigService.getSSOConfig(TENANT, "apple")).thenReturn(Optional.empty());

        assertThat(service.resolveOrProvision(TENANT, "apple", "a@acme.com", "A", "B")).isEmpty();
    }

    @Test
    void shouldProvisionAdminFromResolveOrProvisionWhenAllowed() {
        AuthUser provisioned = activeUser("user-2", TENANT, "a@acme.com");
        when(userService.findActiveByEmailAndTenant("a@acme.com", TENANT)).thenReturn(Optional.empty());
        when(ssoConfigService.getSSOConfig(TENANT, "apple"))
                .thenReturn(Optional.of(tenantApp(true, true, List.of("acme.com"))));
        when(userService.registerOrReactivateFromSso(TENANT, "a@acme.com", "A", "B", List.of(UserRole.ADMIN), "apple"))
                .thenReturn(provisioned);

        assertThat(service.resolveOrProvision(TENANT, "apple", "a@acme.com", "A", "B")).contains(provisioned);
        verify(registrationProcessor).postProcessAutoProvision(provisioned, null);
    }
}
