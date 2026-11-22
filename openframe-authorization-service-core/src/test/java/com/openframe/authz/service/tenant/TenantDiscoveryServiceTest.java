package com.openframe.authz.service.tenant;

import com.openframe.authz.controller.TenantDiscoveryController;
import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.policy.GlobalDomainPolicyLookup;
import com.openframe.authz.service.sso.CompanySsoLoginService;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.config.AuthHardeningProperties;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.document.tenant.TenantStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TenantDiscoveryServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private TenantService tenantService;
    @Mock
    private SSOConfigService ssoConfigService;
    @Mock
    private CompanySsoLoginService companySsoLoginService;
    @Mock
    private GlobalDomainPolicyLookup globalDomainPolicyLookup;
    private TenantDiscoveryService service;

    @BeforeEach
    void setUp() {
        service = discoveryService(true);
        lenient().when(ssoConfigService.getEffectiveProvidersForTenant(anyString())).thenReturn(List.of("google", "microsoft"));
        lenient().when(ssoConfigService.isOpenframeLoginEnabled(anyString())).thenReturn(true);
        lenient().when(userService.findActiveByEmail(anyString())).thenReturn(Optional.empty());
        lenient().when(ssoConfigService.findAutoProvisionByDomain(anyString())).thenReturn(Optional.empty());
    }

    @Test
    void shouldReturnTenantAndProvidersForExistingUser() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u", "t-1", "ada@acme.com")));
        when(tenantService.findById("t-1")).thenReturn(Optional.of(tenant("t-1", TenantStatus.ACTIVE)));

        TenantDiscoveryResponse response = service.discoverTenantForEmail("ada@acme.com");

        assertThat(response.isHasExistingAccounts()).isTrue();
        assertThat(response.getTenantId()).isEqualTo("t-1");
        assertThat(response.getDomain()).isEqualTo("t-1.example.com");
        assertThat(response.getTenantName()).isNull();
        assertThat(response.getAuthProviders()).containsExactly("google", "microsoft", SSOConfig.OPENFRAME_PROVIDER);
    }

    @Test
    void shouldHidePasswordLoginWhenDisabledForTenant() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u", "t-1", "ada@acme.com")));
        when(tenantService.findById("t-1")).thenReturn(Optional.of(tenant("t-1", TenantStatus.ACTIVE)));
        when(ssoConfigService.isOpenframeLoginEnabled("t-1")).thenReturn(false);

        assertThat(service.discoverTenantForEmail("ada@acme.com").getAuthProviders()).doesNotContain(SSOConfig.OPENFRAME_PROVIDER);
    }

    @Test
    void shouldReportNoAccountForUserOfInactiveTenant() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u", "t-1", "ada@acme.com")));
        when(tenantService.findById("t-1")).thenReturn(Optional.of(tenant("t-1", TenantStatus.BLOCKED)));

        TenantDiscoveryResponse response = service.discoverTenantForEmail("ada@acme.com");

        assertThat(response.isHasExistingAccounts()).isFalse();
        assertThat(response.getTenantId()).isNull();
    }

    @Test
    void shouldOfferCompanySignInWithoutPublishingTenantDetailsForNewEmployee() {
        SSOPerTenantConfig config = new SSOPerTenantConfig();
        config.setTenantId("sso-tenant");
        config.setProvider("microsoft");
        when(ssoConfigService.findAutoProvisionByDomain("acme.com")).thenReturn(Optional.of(config));
        when(tenantService.findById("sso-tenant")).thenReturn(Optional.of(tenant("sso-tenant", TenantStatus.ACTIVE)));
        when(companySsoLoginService.issue("sso-tenant", List.of("microsoft"))).thenReturn("company-login-handle");

        TenantDiscoveryResponse response = service.discoverTenantForEmail("new@acme.com");
        String body = new ObjectMapper().writeValueAsString(response);

        assertThat(response.isHasExistingAccounts()).isFalse();
        assertThat(response.getCustomProviders()).containsExactly("microsoft");
        assertThat(body).contains("\"sso_login_handle\":\"company-login-handle\"")
                .doesNotContain("\"tenant_id\"", "\"tenant_name\"", "\"domain\"");
    }

    @Test
    void shouldReturnHandleAndPreservePasswordLoginForAnExistingCompanyMember() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u", "t-1", "ada@acme.com")));
        when(tenantService.findById("t-1")).thenReturn(Optional.of(tenant("t-1", TenantStatus.ACTIVE)));
        when(ssoConfigService.getCustomProvidersForTenant("t-1")).thenReturn(List.of("microsoft"));
        when(companySsoLoginService.issue("t-1", List.of("microsoft"))).thenReturn("company-login-handle");

        TenantDiscoveryResponse response = service.discoverTenantForEmail("ada@acme.com");

        assertThat(response.isHasExistingAccounts()).isTrue();
        assertThat(response.getSsoLoginHandle()).isEqualTo("company-login-handle");
        assertThat(response.getAuthProviders()).contains(SSOConfig.OPENFRAME_PROVIDER);
    }

    @Test
    void shouldReportNoAccountForUnknownDomain() {
        assertThat(service.discoverTenantForEmail("new@nowhere.com").isHasExistingAccounts()).isFalse();
    }

    @Test
    void disabledHardeningExposesThePreviousCompanySelectionContract() throws Exception {
        SSOPerTenantConfig config = new SSOPerTenantConfig();
        config.setTenantId("sso-tenant");
        config.setProvider("microsoft");
        when(ssoConfigService.findAutoProvisionByDomain("acme.com")).thenReturn(Optional.of(config));
        when(tenantService.findById("sso-tenant")).thenReturn(Optional.of(tenant("sso-tenant", TenantStatus.ACTIVE)));
        MockMvc http = MockMvcBuilders.standaloneSetup(new TenantDiscoveryController(discoveryService(false), userService,
                mock(EmailDomainPolicy.class))).build();

        http.perform(get("/tenant/discover").param("email", "new@acme.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.has_existing_accounts").value(true))
                .andExpect(jsonPath("$.tenant_id").value("sso-tenant"))
                .andExpect(jsonPath("$.tenant_name").isNotEmpty())
                .andExpect(jsonPath("$.domain").value("sso-tenant.example.com"))
                .andExpect(jsonPath("$.sso_login_handle").doesNotExist());
        verifyNoInteractions(companySsoLoginService);
    }

    @Test
    void disabledHardeningRestoresLookupThroughTheGlobalDomainPolicy() {
        when(globalDomainPolicyLookup.findTenantIdByDomainIfAutoAllowed("acme.com")).thenReturn(Optional.of("t-1"));
        when(tenantService.findById("t-1")).thenReturn(Optional.of(tenant("t-1", TenantStatus.ACTIVE)));

        TenantDiscoveryResponse response = discoveryService(false).discoverTenantForEmail("new@acme.com");

        assertThat(response.getTenantId()).isEqualTo("t-1");
        assertThat(response.getTenantName()).isEqualTo("Tenant t-1");
        assertThat(response.getSsoLoginHandle()).isNull();
        verifyNoInteractions(companySsoLoginService);
    }

    private TenantDiscoveryService discoveryService(boolean enabled) {
        return new TenantDiscoveryService(userService, tenantService, ssoConfigService, companySsoLoginService,
                globalDomainPolicyLookup, new AuthHardeningProperties(enabled));
    }
}
