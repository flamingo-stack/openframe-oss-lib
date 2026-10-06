package com.openframe.authz.config.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicReference;

import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TenantFiltersTest {

    private final TenantContextFilter tenantFilter = new TenantContextFilter();
    private final TenantForwardedPrefixFilter prefixFilter = new TenantForwardedPrefixFilter();

    @AfterEach
    void clear() {
        TenantContext.clear();
    }

    /** Runs the tenant filter and reports the tenant the downstream chain saw. */
    private String tenantSeenBy(MockHttpServletRequest request) throws ServletException, IOException {
        AtomicReference<String> seen = new AtomicReference<>();
        FilterChain chain = (req, res) -> seen.set(TenantContext.getTenantId());
        tenantFilter.doFilter(request, new MockHttpServletResponse(), chain);
        return seen.get();
    }

    @ParameterizedTest
    @ValueSource(strings = {"/acme/oauth2/authorize", "/acme/.well-known/openid-configuration", "/acme/connect/register",
            "/acme/login", "/acme/userinfo"})
    void shouldTakeTenantFromPathOfSasEndpoints(String path) throws Exception {
        assertThat(tenantSeenBy(new MockHttpServletRequest("GET", path))).isEqualTo("acme");
    }

    @ParameterizedTest
    @ValueSource(strings = {"/login/oauth2/x", "/sso/oauth2/x", "/sas/oauth2/x", "/public/oauth2/x", "/.well-known/oauth2/x",
            "/acme/other", "/acme"})
    void shouldNotTreatReservedOrNonSasPathsAsTenant(String path) throws Exception {
        assertThat(tenantSeenBy(new MockHttpServletRequest("GET", path))).isNull();
    }

    @Test
    void shouldStripContextPathBeforeReadingTenant() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/sas/acme/oauth2/token");
        request.setContextPath("/sas");

        assertThat(tenantSeenBy(request)).isEqualTo("acme");
    }

    @Test
    void shouldFallBackToQueryParameterThenSession() throws Exception {
        MockHttpServletRequest byParam = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        byParam.setParameter("tenant", "acme");
        MockHttpServletRequest bySession = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(TenantContextFilter.TENANT_ID, "stored");
        bySession.setSession(session);

        assertThat(tenantSeenBy(byParam)).isEqualTo("acme");
        assertThat(byParam.getSession(false).getAttribute(TenantContextFilter.TENANT_ID)).isEqualTo("acme");
        assertThat(tenantSeenBy(bySession)).isEqualTo("stored");
    }

    @Test
    void shouldInvalidateSessionWhenSwitchingBetweenRealTenants() throws Exception {
        MockHttpSession tenantASession = new MockHttpSession();
        tenantASession.setAttribute(TenantContextFilter.TENANT_ID, "tenant-a");
        tenantASession.setAttribute("SPRING_SECURITY_CONTEXT", "authenticated-in-a");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/tenant-b/oauth2/authorize");
        request.setSession(tenantASession);

        assertThat(tenantSeenBy(request)).isEqualTo("tenant-b");
        assertThat(tenantASession.isInvalid()).isTrue();
        assertThat(request.getSession(false)).isNotSameAs(tenantASession);
        assertThat(request.getSession(false).getAttribute("SPRING_SECURITY_CONTEXT")).isNull();
    }

    @Test
    void shouldKeepSessionWhenMovingFromOnboardingToRealTenant() throws Exception {
        MockHttpSession onboarding = new MockHttpSession();
        onboarding.setAttribute(TenantContextFilter.TENANT_ID, ONBOARDING_TENANT_ID);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/new-tenant/oauth2/authorize");
        request.setSession(onboarding);

        assertThat(tenantSeenBy(request)).isEqualTo("new-tenant");
        assertThat(onboarding.isInvalid()).isFalse();
        assertThat(onboarding.getAttribute(TenantContextFilter.TENANT_ID)).isEqualTo("new-tenant");
    }

    @Test
    void shouldClearTenantContextEvenWhenChainThrows() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/acme/oauth2/token");

        assertThatThrownBy(() -> tenantFilter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(TenantContext.getTenantId()).isNull();
    }

    private String prefixSeenBy(MockHttpServletRequest request) throws ServletException, IOException {
        AtomicReference<String> seen = new AtomicReference<>();
        prefixFilter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> seen.set(((HttpServletRequest) req).getHeader("X-Forwarded-Prefix")));
        return seen.get();
    }

    @ParameterizedTest
    @CsvSource({"/oauth2/token,/acme", "/.well-known/openid-configuration,/acme", "/connect/register,/acme", "/userinfo,/acme"})
    void shouldAddTenantPrefixToUnprefixedSasEndpoints(String path, String expected) throws Exception {
        TenantContext.setTenantId("acme");

        assertThat(prefixSeenBy(new MockHttpServletRequest("GET", path))).isEqualTo(expected);
    }

    @Test
    void shouldLeaveOtherRequestsAlone() throws Exception {
        TenantContext.setTenantId("acme");
        MockHttpServletRequest alreadyPrefixed = new MockHttpServletRequest("GET", "/acme/oauth2/token");
        MockHttpServletRequest withHeader = new MockHttpServletRequest("GET", "/oauth2/token");
        withHeader.addHeader("X-Forwarded-Prefix", "/sas");

        assertThat(prefixSeenBy(alreadyPrefixed)).isNull();
        assertThat(prefixSeenBy(withHeader)).isEqualTo("/sas");
        assertThat(prefixSeenBy(new MockHttpServletRequest("GET", "/login"))).isNull();
        TenantContext.clear();
        assertThat(prefixSeenBy(new MockHttpServletRequest("GET", "/oauth2/token"))).isNull();
    }
}
