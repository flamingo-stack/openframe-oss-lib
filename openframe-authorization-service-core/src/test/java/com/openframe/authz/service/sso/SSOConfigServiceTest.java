package com.openframe.authz.service.sso;

import com.openframe.authz.config.oidc.GoogleSSOProperties;
import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.tenant.SSOPerTenantConfig;
import com.openframe.data.repository.tenant.SSOPerTenantConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SSOConfigServiceTest {

    private final SSOPerTenantConfigRepository repository = mock(SSOPerTenantConfigRepository.class);
    private final EncryptionService encryption = new EncryptionService("0123456789abcdef0123456789abcdef", "0123456789abcdef");
    private SSOConfigService service;

    @BeforeEach
    void setUp() {
        GoogleSSOProperties google = new GoogleSSOProperties();
        google.setDefaultClientId("generic-google");
        google.setDefaultClientSecret("generic-secret");
        MicrosoftSSOProperties microsoft = new MicrosoftSSOProperties();
        service = new SSOConfigService(repository, encryption, List.of(google, microsoft));
        when(repository.findFirstByTenantIdAndProviderAndEnabledTrue(anyString(), anyString())).thenReturn(Optional.empty());
    }

    private static SSOPerTenantConfig tenantConfig(String provider, String clientId) {
        SSOPerTenantConfig cfg = new SSOPerTenantConfig();
        cfg.setTenantId("acme");
        cfg.setProvider(provider);
        cfg.setClientId(clientId);
        cfg.setEnabled(true);
        return cfg;
    }

    @Test
    void shouldPreferTenantAppOverGenericDefault() {
        SSOPerTenantConfig own = tenantConfig("google", "acme-google");
        when(repository.findFirstByTenantIdAndProviderAndEnabledTrue("acme", "google")).thenReturn(Optional.of(own));

        assertThat(service.getEffectiveSSOConfig("acme", "google")).containsSame(own);
    }

    @Test
    void shouldFallBackToConfiguredDefaultWithEncryptedSecret() {
        SSOConfig generic = service.getEffectiveSSOConfig("acme", "google").orElseThrow();

        assertThat(generic.getClientId()).isEqualTo("generic-google");
        assertThat(generic.getClientSecret()).isNotEqualTo("generic-secret");
        assertThat(service.getDecryptedClientSecret(generic)).isEqualTo("generic-secret");
    }

    @Test
    void shouldHaveNoConfigForUnconfiguredDefault() {
        assertThat(service.getEffectiveSSOConfig("acme", "microsoft")).isEmpty();
        assertThat(service.getDefaultProviders()).containsExactly("google");
    }

    @Test
    void shouldMergeTenantAndDefaultProvidersWithoutBuiltInLogin() {
        when(repository.findByTenantIdAndEnabledTrue("acme")).thenReturn(List.of(
                tenantConfig("Microsoft", "m"), tenantConfig(SSOConfig.OPENFRAME_PROVIDER, null)));

        assertThat(service.getEffectiveProvidersForTenant("acme")).containsExactly("microsoft", "google");
    }

    @Test
    void shouldTreatMissingBuiltInLoginToggleAsEnabled() {
        SSOPerTenantConfig disabled = tenantConfig(SSOConfig.OPENFRAME_PROVIDER, null);
        disabled.setEnabled(false);
        when(repository.findFirstByTenantIdAndProvider("acme", SSOConfig.OPENFRAME_PROVIDER)).thenReturn(Optional.empty());
        when(repository.findFirstByTenantIdAndProvider("locked", SSOConfig.OPENFRAME_PROVIDER)).thenReturn(Optional.of(disabled));

        assertThat(service.isOpenframeLoginEnabled("acme")).isTrue();
        assertThat(service.isOpenframeLoginEnabled("locked")).isFalse();
    }

    @Test
    void shouldFindOnlyEnabledAutoProvisioningAppForDomain() {
        SSOPerTenantConfig off = tenantConfig("google", "a");
        off.setAutoProvisionUsers(false);
        SSOPerTenantConfig on = tenantConfig("google", "b");
        on.setAutoProvisionUsers(true);
        when(repository.findByAllowedDomainsIn(List.of("acme.com"))).thenReturn(List.of(off, on));

        assertThat(service.findAutoProvisionByDomain("ACME.com")).containsSame(on);
        assertThat(service.findAutoProvisionByDomain(" ")).isEmpty();
    }

    @Test
    void shouldReturnNullSecretWhenNoneStored() {
        assertThat(service.getDecryptedClientSecret(new SSOConfig())).isNull();
    }
}
