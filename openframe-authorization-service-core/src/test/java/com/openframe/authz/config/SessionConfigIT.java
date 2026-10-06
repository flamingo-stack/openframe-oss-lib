package com.openframe.authz.config;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import java.net.http.HttpResponse;
import java.util.Map;
import java.util.Set;

import static com.openframe.authz.config.SessionTestApplication.CONTEXT_PATH;
import static com.openframe.authz.config.SessionTestApplication.get;
import static com.openframe.authz.config.SessionTestApplication.sessionCookie;
import static com.openframe.authz.config.SessionTestApplication.sessionCookieHeaders;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The session wiring against a real Redis. Boots the app twice against one Redis — two "pods" — to
 * check that sessions, including the tenant bound by TenantContextFilter, survive an auth-server
 * rollout, and checks the Redis-side details (key namespace, session-id rename, lenient reads).
 */
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class SessionConfigIT {

    private static final String TENANT = "test-tenant";
    private static final String KEY_NAMESPACE = "of:{" + TENANT + "}:session:";

    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

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
            cookie = sessionCookie(get(podA, "/put?value=in-progress-login", null));
        }

        try (ConfigurableApplicationContext podB = startPod()) {
            assertThat(get(podB, "/get", cookie).body()).isEqualTo("in-progress-login");
        }
    }

    @Test
    @DisplayName("Given a tenant-scoped login page on one pod, when another pod serves the next request, then the tenant is still bound to the session")
    void tenant_survivesPodRestart() throws Exception {
        String cookie;
        try (ConfigurableApplicationContext podA = startPod()) {
            HttpResponse<String> login = get(podA, "/tenant-a/login", null);
            assertThat(sessionCookieHeaders(login)).hasSize(1);
            cookie = sessionCookie(login);
        }

        try (ConfigurableApplicationContext podB = startPod()) {
            assertThat(get(podB, "/tenant", cookie).body()).isEqualTo("tenant-a");
        }
    }

    @Test
    @DisplayName("Given the session cookie config, when a session is created, then the cookie keeps the JSESSIONID name, the context path and the configured SameSite/Secure")
    void sessionCookie_keepsNameAndAttributes() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            assertThat(sessionCookieHeaders(get(pod, "/put?value=x", null))).singleElement()
                    .satisfies(header -> assertThat(header)
                            .startsWith("JSESSIONID=")
                            .contains("Path=" + CONTEXT_PATH + ";")
                            .contains("SameSite=None")
                            .contains("Secure"));
        }
    }

    @Test
    @DisplayName("Given a session, when it is stored, then its key sits under the openframe tenant namespace with a cluster hash tag")
    void sessionKey_isNamespaced() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            String sessionId = get(pod, "/put?value=x", null).body();

            Set<String> keys = pod.getBean(StringRedisTemplate.class).keys("*");
            assertThat(keys).isNotEmpty().allMatch(k -> k.startsWith(KEY_NAMESPACE)).contains(KEY_NAMESPACE + "sessions:" + sessionId);
        }
    }

    @Test
    @DisplayName("Given a tenant session, when the session id changes on login, then the Redis key is renamed and the tenant and attributes move with it")
    void sessionIdChange_renamesKey() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            String cookie = sessionCookie(get(pod, "/tenant-a/login", null));
            String oldId = get(pod, "/put?value=in-progress-login", cookie).body();

            HttpResponse<String> rotated = get(pod, "/rotate", cookie);
            String newCookie = sessionCookie(rotated);

            StringRedisTemplate redis = pod.getBean(StringRedisTemplate.class);
            assertThat(redis.hasKey(KEY_NAMESPACE + "sessions:" + oldId)).isFalse();
            assertThat(redis.hasKey(KEY_NAMESPACE + "sessions:" + rotated.body())).isTrue();
            assertThat(get(pod, "/tenant", newCookie).body()).isEqualTo("tenant-a");
            assertThat(get(pod, "/get", newCookie).body()).isEqualTo("in-progress-login");
        }
    }

    @Test
    @DisplayName("Given a stored attribute that no longer deserializes, when the session is read, then the attribute is absent instead of the request failing")
    void undeserializableAttribute_readsAsAbsent() throws Exception {
        try (ConfigurableApplicationContext pod = startPod()) {
            HttpResponse<String> put = get(pod, "/put?value=x", null);
            // Spring Session stores each attribute as a "sessionAttr:<name>" field of the session hash.
            pod.getBean(StringRedisTemplate.class).opsForHash()
                    .put(KEY_NAMESPACE + "sessions:" + put.body(), "sessionAttr:value", "not-java-serialized");

            HttpResponse<String> read = get(pod, "/get", sessionCookie(put));

            assertThat(read.statusCode()).isEqualTo(200);
            assertThat(read.body()).isEqualTo("none");
        }
    }

    private static ConfigurableApplicationContext startPod() {
        return SessionTestApplication.start(RedisSessionStore.class, Map.of(
                "spring.data.redis.host", REDIS.getHost(),
                "spring.data.redis.port", REDIS.getMappedPort(6379),
                "openframe.redis.tenant-id", TENANT));
    }

    @Configuration
    @ImportAutoConfiguration(RedisAutoConfiguration.class)
    static class RedisSessionStore {
    }
}
