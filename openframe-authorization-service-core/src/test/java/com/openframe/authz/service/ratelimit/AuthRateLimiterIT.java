package com.openframe.authz.service.ratelimit;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Counting windows and blocks against a real Redis: the TTLs are what make every limit temporary. */
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class AuthRateLimiterIT {

    private static final Duration WINDOW = Duration.ofMinutes(15);

    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static StringRedisTemplate redis;

    private AuthRateLimiter limiter;
    private LoginAttemptLimiter loginLimiter;

    @BeforeAll
    static void startRedis() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        redis = new StringRedisTemplate(connectionFactory);
        redis.afterPropertiesSet();
    }

    @AfterAll
    static void stopRedis() {
        connectionFactory.destroy();
        REDIS.stop();
    }

    @BeforeEach
    void setUp() {
        redis.getConnectionFactory().getConnection().serverCommands().flushAll();
        limiter = new AuthRateLimiter(redis, new OpenframeRedisKeyBuilder(new OpenframeRedisProperties()));
        loginLimiter = new LoginAttemptLimiter(limiter, 10, 50, WINDOW);
    }

    @Test
    void increment_firstHit_keyExpiresWithTheWindow() {
        limiter.increment("reset:ip:1.2.3.4", Duration.ofHours(1));

        String key = onlyKey();
        assertThat(redis.getExpire(key)).isBetween(3590L, 3600L);
    }

    @Test
    void increment_keyLeftWithoutTtl_getsTheWindowBack() {
        limiter.increment("reset:ip:1.2.3.4", Duration.ofHours(1));
        String key = onlyKey();
        redis.persist(key);

        limiter.increment("reset:ip:1.2.3.4", Duration.ofHours(1));

        assertThat(redis.opsForValue().get(key)).isEqualTo("2");
        assertThat(redis.getExpire(key)).isPositive();
    }

    @Test
    void loginBlock_tenthFailure_blocksForFifteenMinutesAndKeyHoldsNoEmail() {
        for (int i = 0; i < 10; i++) {
            loginLimiter.recordFailure("t1", "ada@acme.com", null);
        }

        assertThat(loginLimiter.isBlocked("t1", "ada@acme.com", null)).isTrue();
        String key = onlyKey();
        assertThat(key).doesNotContain("ada").contains(AuthRateLimiter.hash("ada@acme.com"));
        assertThat(redis.getExpire(key)).isBetween(WINDOW.toSeconds() - 10, WINDOW.toSeconds());
    }

    @Test
    void loginBlock_afterTheKeyExpires_isLifted() {
        for (int i = 0; i < 10; i++) {
            loginLimiter.recordFailure("t1", "ada@acme.com", null);
        }
        redis.pexpire(onlyKey(), 1);
        await();

        assertThat(loginLimiter.isBlocked("t1", "ada@acme.com", null)).isFalse();
    }

    private static String onlyKey() {
        Set<String> keys = redis.keys("*");
        assertThat(keys).hasSize(1);
        return keys.iterator().next();
    }

    private static void await() {
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
