package com.openframe.authz.config;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.session.data.redis.RedisSessionRepository;
import org.springframework.session.web.http.CookieSerializer.CookieValue;
import org.springframework.session.web.http.DefaultCookieSerializer;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static com.openframe.authz.web.AuthStateUtils.JSESSIONID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SessionConfigTest {

    private final SessionConfig config = new SessionConfig();

    @Test
    @DisplayName("Given a servlet context path, when the session cookie is written, then it is JSESSIONID on that path even if the request's context path was rewritten")
    void sessionCookie_usesServletContextPath() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("/tenant-a");

        String setCookie = writeSessionCookie("/sas", request);

        assertThat(setCookie).startsWith(JSESSIONID + "=").contains("Path=/sas;");
    }

    @Test
    @DisplayName("Given no servlet context path, when the session cookie is written, then it sits on the root path")
    void sessionCookie_rootPathWithoutContextPath() {
        assertThat(writeSessionCookie("", new MockHttpServletRequest())).startsWith(JSESSIONID + "=").contains("Path=/;");
    }

    @Test
    @DisplayName("Given an openframe tenant id, when the session repository is customized, then session keys sit under that tenant's hash-tagged namespace")
    void sessionKeys_tenantNamespace() {
        assertThat(sessionKeyFor("qashared")).isEqualTo("of:{qashared}:session:sessions:abc");
    }

    @Test
    @DisplayName("Given no openframe tenant id, when the session repository is customized, then session keys fall back to the shared namespace")
    void sessionKeys_sharedFallback() {
        assertThat(sessionKeyFor(null)).isEqualTo("of:{shared}:session:sessions:abc");
        assertThat(sessionKeyFor(" ")).isEqualTo("of:{shared}:session:sessions:abc");
    }

    @Test
    @DisplayName("Given a serializable attribute, when it is written and read back, then the value round-trips")
    void serializer_roundTrips() {
        RedisSerializer<Object> serializer = config.springSessionDefaultRedisSerializer();

        assertThat(serializer.deserialize(serializer.serialize("in-progress-login"))).isEqualTo("in-progress-login");
    }

    @Test
    @DisplayName("Given stored bytes that no longer deserialize, when they are read, then the attribute reads as absent instead of throwing")
    void serializer_undeserializableReadsAsNull() {
        RedisSerializer<Object> serializer = config.springSessionDefaultRedisSerializer();

        assertThat(serializer.deserialize("not-java-serialized".getBytes(StandardCharsets.UTF_8))).isNull();
    }

    private String writeSessionCookie(String contextPath, MockHttpServletRequest request) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        config.sessionCookieCustomizer(contextPath).customize(serializer);
        MockHttpServletResponse response = new MockHttpServletResponse();

        serializer.writeCookieValue(new CookieValue(request, response, "session-id"));

        return response.getHeader("Set-Cookie");
    }

    @SuppressWarnings("unchecked")
    private String sessionKeyFor(String tenantId) {
        OpenframeRedisProperties properties = new OpenframeRedisProperties();
        properties.setTenantId(tenantId);
        RedisOperations<String, Object> redis = mock(RedisOperations.class);
        HashOperations<String, Object, Object> hashes = mock(HashOperations.class);
        when(redis.opsForHash()).thenReturn(hashes);
        when(hashes.entries(anyString())).thenReturn(Map.of());
        RedisSessionRepository repository = new RedisSessionRepository(redis);

        config.sessionKeyNamespaceCustomizer(new OpenframeRedisKeyBuilder(properties), properties).customize(repository);
        repository.findById("abc");

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(hashes).entries(key.capture());
        return key.getValue();
    }
}
