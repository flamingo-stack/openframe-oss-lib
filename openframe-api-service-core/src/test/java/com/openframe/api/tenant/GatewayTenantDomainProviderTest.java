package com.openframe.api.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayTenantDomainProviderTest {

    private final GatewayTenantDomainProvider provider = new GatewayTenantDomainProvider();

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void readsTheDomainTheGatewayStamped() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(GatewayTenantDomainProvider.TENANT_DOMAIN_HEADER, "acme.openframe.ai");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(provider.currentTenantDomain()).contains("acme.openframe.ai");
    }

    @Test
    @DisplayName("a request that never passed the gateway carries no domain")
    void emptyWhenTheHeaderIsAbsent() {
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(new MockHttpServletRequest()));

        assertThat(provider.currentTenantDomain()).isEmpty();
    }

    @Test
    @DisplayName("outside a request entirely, e.g. a scheduled job")
    void emptyWhenThereIsNoRequest() {
        assertThat(provider.currentTenantDomain()).isEmpty();
    }
}
