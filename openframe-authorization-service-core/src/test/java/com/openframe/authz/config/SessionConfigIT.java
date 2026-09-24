package com.openframe.authz.config;

import com.openframe.data.redis.OpenframeRedisKeyConfiguration;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.http.HttpMessageConvertersAutoConfiguration;
import org.springframework.boot.autoconfigure.session.SessionAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the session setup twice against one Redis — two "pods" — and checks that a session created
 * on the first survives it being shut down, as it must across an auth-server rollout.
 */
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class SessionConfigIT {

    private static final String TENANT = "test-tenant";

    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeAll
    static void startRedis() {
        REDIS.start();
    }

    @AfterAll
    static void stopRedis() {
        REDIS.stop();
    }

    @Test
    @DisplayName("Given a session created on one pod, when that pod stops and another serves the next request, then the session attributes are still there")
    void session_survivesPodRestart() throws Exception {
        String cookie;
        try (ConfigurableApplicationContext podA = startPod()) {
            HttpResponse<String> put = get(podA, "/put?value=in-progress-login", null);
            cookie = sessionCookie(put);
        }

        try (ConfigurableApplicationContext podB = startPod()) {
            assertThat(get(podB, "/get", cookie).body()).isEqualTo("in-progress-login");
        }
    }

    @Test
    @DisplayName("Given the session cookie config, when a session is created, then the cookie keeps the JSESSIONID name and the configured SameSite/Secure")
    void sessionCookie_keepsNameAndAttributes() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            String setCookie = get(pod, "/put?value=x", null).headers().firstValue("Set-Cookie").orElseThrow();

            assertThat(setCookie).startsWith("JSESSIONID=").contains("SameSite=None").contains("Secure");
        }
    }

    @Test
    @DisplayName("Given a session, when it is stored, then its key sits under the openframe tenant namespace with a cluster hash tag")
    void sessionKey_isNamespaced() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            get(pod, "/put?value=x", null);

            Set<String> keys = pod.getBean(StringRedisTemplate.class).keys("*");
            assertThat(keys).isNotEmpty().allMatch(k -> k.startsWith("of:{" + TENANT + "}:session:"));
        }
    }

    @Test
    @DisplayName("Given a stored attribute that no longer deserializes, when the session is read, then the attribute is absent instead of the request failing")
    void undeserializableAttribute_readsAsAbsent() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            HttpResponse<String> put = get(pod, "/put?value=x", null);
            // Spring Session stores each attribute as a "sessionAttr:<name>" field of the session hash.
            pod.getBean(StringRedisTemplate.class).opsForHash()
                    .put("of:{" + TENANT + "}:session:sessions:" + put.body(), "sessionAttr:value", "not-java-serialized");

            HttpResponse<String> read = get(pod, "/get", sessionCookie(put));

            assertThat(read.statusCode()).isEqualTo(200);
            assertThat(read.body()).isEqualTo("none");
        }
    }

    private static ConfigurableApplicationContext startPod() {
        return new SpringApplicationBuilder(SessionTestApplication.class).properties(
                "server.port=0",
                "spring.data.redis.host=" + REDIS.getHost(),
                "spring.data.redis.port=" + REDIS.getMappedPort(6379),
                "server.servlet.session.cookie.same-site=none",
                "server.servlet.session.cookie.secure=true",
                "openframe.redis.tenant-id=" + TENANT
        ).run();
    }

    private HttpResponse<String> get(ConfigurableApplicationContext pod, String path, String cookie) throws Exception {
        int port = ((ServletWebServerApplicationContext) pod).getWebServer().getPort();
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String sessionCookie(HttpResponse<String> response) {
        return response.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
    }

    @SpringBootConfiguration
    @ImportAutoConfiguration({
            ServletWebServerFactoryAutoConfiguration.class,
            DispatcherServletAutoConfiguration.class,
            WebMvcAutoConfiguration.class,
            HttpMessageConvertersAutoConfiguration.class,
            RedisAutoConfiguration.class,
            SessionAutoConfiguration.class
    })
    @Import({SessionConfig.class, OpenframeRedisKeyConfiguration.class, SessionTestApplication.SessionController.class})
    static class SessionTestApplication {

        @RestController
        static class SessionController {

            @GetMapping("/put")
            String put(HttpSession session, @RequestParam String value) {
                session.setAttribute("value", value);
                return session.getId();
            }

            @GetMapping("/get")
            String get(HttpSession session) {
                Object value = session.getAttribute("value");
                return value == null ? "none" : value.toString();
            }
        }
    }
}
