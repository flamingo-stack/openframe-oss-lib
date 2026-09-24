package com.openframe.authz.config;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.session.DefaultCookieSerializerCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.serializer.JdkSerializationRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.SerializationException;
import org.springframework.session.config.SessionRepositoryCustomizer;
import org.springframework.session.data.redis.RedisSessionRepository;
import org.springframework.util.StringUtils;

import static com.openframe.authz.web.AuthStateUtils.JSESSIONID;

/**
 * HTTP session stored in Redis (Spring Session) instead of Tomcat memory.
 *
 * <p>Login flows keep state in the session between requests: the OAuth2 authorization request of an
 * SSO login, the saved /oauth2/authorize request, the SecurityContext, the CSRF token, TENANT_ID and
 * the join-invite id. In memory, every auth-server restart or rollout drops it and in-progress logins
 * fail (e.g. {@code authorization_request_not_found}); it also pins the service to one replica.
 *
 * <p>Cookie SameSite/Secure/timeout still come from {@code server.servlet.session.*}.
 */
@Slf4j
@Configuration
public class SessionConfig {

    /**
     * Keeps Tomcat's cookie name: {@link com.openframe.authz.web.AuthStateUtils#clearAuthState} and
     * clients address the session cookie as JSESSIONID.
     */
    @Bean
    public DefaultCookieSerializerCustomizer sessionCookieNameCustomizer() {
        return serializer -> serializer.setCookieName(JSESSIONID);
    }

    /**
     * Namespaces session keys like every other openframe Redis key ({@code of:{shared}:session:...}).
     * The hash tag also keeps a session's old and new key in one cluster slot, which the RENAME on
     * login (session-fixation protection) requires. Falls back to {@code shared} rather than failing
     * startup where {@code openframe.redis.tenant-id} is not set.
     */
    @Bean
    public SessionRepositoryCustomizer<RedisSessionRepository> sessionKeyNamespaceCustomizer(OpenframeRedisKeyBuilder keyBuilder,
                                                                                             OpenframeRedisProperties redisProperties) {
        String tenantId = StringUtils.hasText(redisProperties.getTenantId()) ? redisProperties.getTenantId() : "shared";
        return repository -> repository.setRedisKeyNamespace(keyBuilder.tenantKey("session", tenantId));
    }

    /**
     * JDK serialization, but an attribute that no longer deserializes reads as absent instead of
     * failing the request. Spring Security bumps its serialVersionUID on every minor release, so after
     * such an upgrade stored sessions would otherwise 500 until they expire; this way the user just
     * starts a fresh login.
     */
    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        JdkSerializationRedisSerializer delegate = new JdkSerializationRedisSerializer(getClass().getClassLoader());
        return new RedisSerializer<>() {
            @Override
            public byte[] serialize(Object value) throws SerializationException {
                return delegate.serialize(value);
            }

            @Override
            public Object deserialize(byte[] bytes) {
                try {
                    return delegate.deserialize(bytes);
                } catch (SerializationException e) {
                    log.warn("Discarding session attribute that cannot be deserialized: {}", e.getMessage());
                    return null;
                }
            }
        };
    }
}
