package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContextFilter;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.boot.web.servlet.AbstractFilterRegistrationBean;
import org.springframework.boot.web.servlet.DelegatingFilterProxyRegistrationBean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.MapSessionRepository;
import org.springframework.session.config.annotation.web.http.EnableSpringHttpSession;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static com.openframe.authz.config.SessionTestApplication.CONTEXT_PATH;
import static com.openframe.authz.config.SessionTestApplication.NONE;
import static com.openframe.authz.config.SessionTestApplication.get;
import static com.openframe.authz.config.SessionTestApplication.sessionCookie;
import static com.openframe.authz.config.SessionTestApplication.sessionCookieHeaders;
import static com.openframe.authz.security.SsoRegistrationConstants.ONBOARDING_TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The auth server's servlet filter chain over Spring Session, with an in-memory session store so it
 * runs in every build. Guards the regression where {@link TenantContextFilter} ran ahead of Spring
 * Session, wrote TENANT_ID into Tomcat's own session and set a second JSESSIONID that the Spring
 * Session one overwrote: the next request had no tenant (password login failed as bad credentials,
 * SSO callbacks as {@code authorization_request_not_found}).
 */
class TenantSessionFilterChainTest {

    private static ConfigurableApplicationContext app;

    @BeforeAll
    static void start() {
        app = SessionTestApplication.start(InMemorySessionStore.class, Map.of());
    }

    @AfterAll
    static void stop() {
        app.close();
    }

    @Test
    @DisplayName("Given the filter registrations, then Spring Session runs first, then the tenant, prefix and forwarded-header filters, all ahead of Spring Security")
    void filterOrder_springSessionFirst() {
        int sessionOrder = app.getBeansOfType(DelegatingFilterProxyRegistrationBean.class).values().stream()
                .filter(reg -> reg.getFilterName().equals("springSessionRepositoryFilter"))
                .mapToInt(AbstractFilterRegistrationBean::getOrder)
                .findFirst().orElseThrow();
        int prefixOrder = app.getBean("tenantForwardedPrefixFilter", FilterRegistrationBean.class).getOrder();
        FilterRegistrationBean<?> forwarded = app.getBean("forwardedHeaderFilter", FilterRegistrationBean.class);

        assertThat(forwarded.getFilter()).isInstanceOf(ForwardedHeaderFilter.class);
        assertThat(sessionOrder).isLessThan(TenantContextFilter.ORDER);
        assertThat(TenantContextFilter.ORDER).isLessThan(prefixOrder);
        assertThat(prefixOrder).isLessThan(forwarded.getOrder());
        assertThat(forwarded.getOrder()).isLessThan(SecurityProperties.DEFAULT_FILTER_ORDER);
    }

    @Test
    @DisplayName("Given a tenant-scoped login page, when it is requested, then exactly one JSESSIONID is set, on the context path")
    void tenantLoginPage_setsOneSessionCookie() throws Exception {
        HttpResponse<String> login = get(app, "/tenant-a/login", null);

        assertThat(sessionCookieHeaders(login)).singleElement()
                .satisfies(header -> assertThat(header).contains("Path=" + CONTEXT_PATH + ";"));
        assertThat(login.body()).isEqualTo("tenant-a");
    }

    @Test
    @DisplayName("Given a tenant-scoped login page, when the next request carries its cookie, then the session still holds the tenant")
    void tenantLoginPage_tenantSurvivesNextRequest() throws Exception {
        String cookie = sessionCookie(get(app, "/tenant-a/login", null));

        HttpResponse<String> next = get(app, "/tenant", cookie);

        assertThat(next.body()).isEqualTo("tenant-a");
        assertThat(sessionCookieHeaders(next)).isEmpty();
    }

    @Test
    @DisplayName("Given a session of one tenant, when another tenant's page is opened, then the old session is dropped and a single new cookie is set")
    void tenantSwitch_startsFreshSession() throws Exception {
        String oldCookie = sessionCookie(get(app, "/tenant-a/login", null));
        get(app, "/put?value=from-tenant-a", oldCookie);

        HttpResponse<String> switched = get(app, "/tenant-b/login", oldCookie);
        String newCookie = sessionCookie(switched);

        assertThat(newCookie).isNotEqualTo(oldCookie);
        assertThat(get(app, "/tenant", newCookie).body()).isEqualTo("tenant-b");
        assertThat(get(app, "/get", newCookie).body()).isEqualTo(NONE);
        assertThat(get(app, "/session-id", oldCookie).body()).isEqualTo(NONE);
    }

    @Test
    @DisplayName("Given an onboarding session, when the real tenant's page is opened, then the session and its attributes are kept")
    void onboardingToTenant_keepsSession() throws Exception {
        String cookie = sessionCookie(get(app, "/" + ONBOARDING_TENANT_ID + "/login", null));
        get(app, "/put?value=sso-in-progress", cookie);

        HttpResponse<String> tenantPage = get(app, "/tenant-a/login", cookie);

        assertThat(sessionCookieHeaders(tenantPage)).isEmpty();
        assertThat(get(app, "/tenant", cookie).body()).isEqualTo("tenant-a");
        assertThat(get(app, "/get", cookie).body()).isEqualTo("sso-in-progress");
    }

    @Test
    @DisplayName("Given a tenant session, when the session id changes on login, then one new cookie is set and the tenant moves with it")
    void sessionIdChange_keepsTenant() throws Exception {
        String cookie = sessionCookie(get(app, "/tenant-a/login", null));

        HttpResponse<String> rotated = get(app, "/rotate", cookie);
        String newCookie = sessionCookie(rotated);

        assertThat(newCookie).isNotEqualTo(cookie);
        assertThat(get(app, "/tenant", newCookie).body()).isEqualTo("tenant-a");
        assertThat(get(app, "/session-id", cookie).body()).isEqualTo(NONE);
    }

    @Test
    @DisplayName("Given an /oauth2 request that gets the tenant prefix, when it creates the session, then the cookie still sits on the context path")
    void oauth2RequestWithTenantPrefix_keepsCookieOnContextPath() throws Exception {
        HttpResponse<String> touch = get(app, "/oauth2/touch?tenant=tenant-a", null);

        assertThat(touch.body()).as("the prefix really was applied").isEqualTo("/tenant-a");
        assertThat(sessionCookieHeaders(touch)).singleElement()
                .satisfies(header -> assertThat(header).contains("Path=" + CONTEXT_PATH + ";"));
        assertThat(get(app, "/tenant", sessionCookie(touch)).body()).isEqualTo("tenant-a");
    }

    @Test
    @DisplayName("Given a proxy-supplied X-Forwarded-Prefix, when a session is created, then the cookie still sits on the context path")
    void forwardedPrefixFromProxy_keepsCookieOnContextPath() throws Exception {
        HttpResponse<String> touch = get(app, "/oauth2/touch", null, "X-Forwarded-Prefix", "/elsewhere");

        assertThat(touch.body()).as("the prefix really was applied").isEqualTo("/elsewhere");
        assertThat(sessionCookieHeaders(touch)).singleElement()
                .satisfies(header -> assertThat(header).contains("Path=" + CONTEXT_PATH + ";"));
    }

    @Configuration
    @EnableSpringHttpSession
    static class InMemorySessionStore {

        @Bean
        MapSessionRepository sessionRepository() {
            return new MapSessionRepository(new ConcurrentHashMap<>());
        }
    }
}
