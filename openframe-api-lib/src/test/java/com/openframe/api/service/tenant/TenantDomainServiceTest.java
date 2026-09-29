package com.openframe.api.service.tenant;

import com.openframe.core.exception.InternalException;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TenantDomainServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String DOMAIN = "acme.openframe.ai";

    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private TenantRepository tenantRepository;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(DOMAIN).build()));
    }

    @Test
    @DisplayName("the request's domain wins, and the tenant record is not read at all")
    void prefersTheDomainStampedOnTheRequest() {
        TenantDomainService service = service(() -> Optional.of("from-request.openframe.ai"));

        assertThat(service.getTenantDomain()).isEqualTo("from-request.openframe.ai");
        verify(tenantRepository, never()).findById(any());
    }

    @Test
    @DisplayName("a blank header is treated as absent, not as a tenant with no domain")
    void fallsBackWhenTheRequestCarriesABlankDomain() {
        assertThat(service(() -> Optional.of("   ")).getTenantDomain()).isEqualTo(DOMAIN);
        assertThat(service(Optional::empty).getTenantDomain()).isEqualTo(DOMAIN);
    }

    @Test
    @DisplayName("no provider bean at all: a module with no HTTP transport still resolves")
    void fallsBackWhenNoProviderIsRegistered() {
        assertThat(new TenantDomainService(absentProvider(), tenantIdProvider, tenantRepository).getTenantDomain())
                .isEqualTo(DOMAIN);
    }

    @Test
    void cachesTheTenantRecordLookupForTheLifeOfThePod() {
        TenantDomainService service = service(Optional::empty);

        service.getTenantDomain();
        service.getTenantDomain();

        verify(tenantRepository, times(1)).findById(TENANT_ID);
    }

    @Test
    @DisplayName("a missing domain is not cached, so a tenant mid-provisioning recovers")
    void doesNotCacheAMissingDomain() {
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).build()))
                .thenReturn(Optional.of(Tenant.builder().id(TENANT_ID).domain(DOMAIN).build()));
        TenantDomainService service = service(Optional::empty);

        assertThatThrownBy(service::getTenantDomain).isInstanceOf(InternalException.class);

        assertThat(service.getTenantDomain()).isEqualTo(DOMAIN);
        verify(tenantRepository, times(2)).findById(TENANT_ID);
    }

    private TenantDomainService service(RequestTenantDomainProvider provider) {
        return new TenantDomainService(providerOf(provider), tenantIdProvider, tenantRepository);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<RequestTenantDomainProvider> providerOf(RequestTenantDomainProvider provider) {
        ObjectProvider<RequestTenantDomainProvider> objectProvider = org.mockito.Mockito.mock(ObjectProvider.class);
        when(objectProvider.getIfAvailable(any())).thenReturn(provider);
        return objectProvider;
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<RequestTenantDomainProvider> absentProvider() {
        ObjectProvider<RequestTenantDomainProvider> objectProvider = org.mockito.Mockito.mock(ObjectProvider.class);
        when(objectProvider.getIfAvailable(any()))
                .thenAnswer(invocation -> invocation.<java.util.function.Supplier<RequestTenantDomainProvider>>getArgument(0).get());
        return objectProvider;
    }
}
