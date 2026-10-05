package com.openframe.authz.config;

import com.openframe.authz.config.tenant.TenantContextFilter;
import com.openframe.authz.config.tenant.TenantFilterConfig;
import com.openframe.data.redis.OpenframeRedisKeyConfiguration;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.session.SessionAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.authz.config.tenant.TenantContextFilter.TENANT_ID;
import static com.openframe.authz.web.AuthStateUtils.JSESSIONID;

/**
 * The auth server's session wiring on a real Tomcat under the {@code /sas} context path:
 * {@link SessionConfig}, {@link TenantContextFilter} and {@link TenantFilterConfig} as in production,
 * plus a probe controller. The session store comes from the test (in-memory map or Redis).
 */
@SpringBootConfiguration
@ImportAutoConfiguration({
        ServletWebServerFactoryAutoConfiguration.class,
        DispatcherServletAutoConfiguration.class,
        WebMvcAutoConfiguration.class,
        HttpMessageConvertersAutoConfiguration.class,
        SessionAutoConfiguration.class
})
@Import({SessionConfig.class, OpenframeRedisKeyConfiguration.class, TenantContextFilter.class, TenantFilterConfig.class,
        SessionTestApplication.SessionController.class})
class SessionTestApplication {

    static final String CONTEXT_PATH = "/sas";
    static final String NONE = "none";

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    static ConfigurableApplicationContext start(Class<?> sessionStore, Map<String, Object> properties) {
        Map<String, Object> props = new HashMap<>(Map.of(
                "server.port", 0,
                "server.servlet.context-path", CONTEXT_PATH,
                "server.servlet.session.cookie.same-site", "none",
                "server.servlet.session.cookie.secure", true));
        props.putAll(properties);
        return new SpringApplicationBuilder(SessionTestApplication.class, sessionStore).properties(props).run();
    }

    static HttpResponse<String> get(ConfigurableApplicationContext app, String path, String cookie, String... headers)
            throws Exception {
        int port = ((ServletWebServerApplicationContext) app).getWebServer().getPort();
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + CONTEXT_PATH + path));
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        if (headers.length > 0) {
            request.headers(headers);
        }
        return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    /** Every Set-Cookie header of the response that sets the session cookie. */
    static List<String> sessionCookieHeaders(HttpResponse<String> response) {
        List<String> result = new ArrayList<>();
        for (String header : response.headers().allValues("Set-Cookie")) {
            if (header.startsWith(JSESSIONID + "=")) {
                result.add(header);
            }
        }
        return result;
    }

    /** The {@code JSESSIONID=<value>} pair of the single session cookie the response sets. */
    static String sessionCookie(HttpResponse<String> response) {
        List<String> headers = sessionCookieHeaders(response);
        if (headers.size() != 1) {
            throw new AssertionError("Expected exactly one " + JSESSIONID + " Set-Cookie, got " + headers);
        }
        return headers.getFirst().split(";", 2)[0];
    }

    @RestController
    static class SessionController {

        /** A tenant-scoped page: {@link TenantContextFilter} binds the tenant from the path. */
        @GetMapping("/{tenant}/login")
        String tenantLogin(@PathVariable String tenant, HttpSession session) {
            return String.valueOf(session.getAttribute(TENANT_ID));
        }

        /** An authorization-server endpoint: {@code TenantForwardedPrefixFilter} adds the tenant prefix here. */
        @GetMapping("/oauth2/touch")
        String oauth2Touch(HttpServletRequest request) {
            request.getSession(true);
            return request.getContextPath();
        }

        @GetMapping("/tenant")
        String tenant(HttpServletRequest request) {
            HttpSession session = request.getSession(false);
            Object tenantId = session == null ? null : session.getAttribute(TENANT_ID);
            return tenantId == null ? NONE : tenantId.toString();
        }

        @GetMapping("/put")
        String put(HttpSession session, @RequestParam String value) {
            session.setAttribute("value", value);
            return session.getId();
        }

        @GetMapping("/get")
        String get(HttpServletRequest request) {
            HttpSession session = request.getSession(false);
            Object value = session == null ? null : session.getAttribute("value");
            return value == null ? NONE : value.toString();
        }

        @GetMapping("/session-id")
        String sessionId(HttpServletRequest request) {
            HttpSession session = request.getSession(false);
            return session == null ? NONE : session.getId();
        }

        /** What a successful login does for session-fixation protection. */
        @GetMapping("/rotate")
        String rotate(HttpServletRequest request) {
            request.getSession(true);
            return request.changeSessionId();
        }
    }
}
