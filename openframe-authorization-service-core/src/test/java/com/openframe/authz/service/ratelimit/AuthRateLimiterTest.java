package com.openframe.authz.service.ratelimit;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static com.openframe.authz.support.TestHashes.sha256;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class AuthRateLimiterTest {

    private static final Duration HOUR = Duration.ofHours(1);

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private ValueOperations<String, String> values;

    private AuthRateLimiter limiter;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        limiter = new AuthRateLimiter(redisTemplate, new OpenframeRedisKeyBuilder(props));
        lenient().when(redisTemplate.opsForValue()).thenReturn(values);
    }

    @Test
    void increment_firstHit_startsTheWindow() {
        when(values.increment(anyString())).thenReturn(1L);

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isEqualTo(1L);

        verify(redisTemplate).expire(anyString(), eq(HOUR));
    }

    @Test
    void increment_laterHitInsideTheWindow_keepsTheWindow() {
        when(values.increment(anyString())).thenReturn(2L);
        when(redisTemplate.getExpire(anyString())).thenReturn(1800L);

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isEqualTo(2L);

        verify(redisTemplate, never()).expire(anyString(), eq(HOUR));
    }

    @Test
    void increment_redisDown_failsOpenWithWarn(CapturedOutput output) {
        when(values.increment(anyString())).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isZero();
        assertThat(output).contains("WARN");
    }

    @Test
    void count_redisDown_failsOpenWithWarn(CapturedOutput output) {
        when(values.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));

        assertThat(limiter.count("login:ip:1.2.3.4")).isZero();
        assertThat(output).contains("WARN");
    }

    @Test
    void count_missingKey_isZero() {
        when(values.get(anyString())).thenReturn(null);

        assertThat(limiter.count("login:ip:1.2.3.4")).isZero();
    }

    @Test
    void count_existingKey_isItsValue() {
        when(values.get(anyString())).thenReturn("7");

        assertThat(limiter.count("login:ip:1.2.3.4")).isEqualTo(7L);
    }

    @Test
    void clearAndRestartWindow_redisDown_doNotThrow() {
        when(redisTemplate.delete(anyString())).thenThrow(new RedisConnectionFailureException("down"));
        when(redisTemplate.expire(anyString(), eq(HOUR))).thenThrow(new RedisConnectionFailureException("down"));

        assertThatCode(() -> limiter.clear("login:ip:1.2.3.4")).doesNotThrowAnyException();
        assertThatCode(() -> limiter.restartWindow("login:ip:1.2.3.4", HOUR)).doesNotThrowAnyException();
    }

    @Test
    void hash_isLowercaseSha256Hex() {
        assertThat(AuthRateLimiter.hash("ada@acme.com"))
                .isEqualTo(sha256("ada@acme.com"))
                .matches("^[0-9a-f]{64}$");
    }

    @Test
    void increment_keyIsGlobalUnderAuthLimitPrefix() {
        when(values.increment(anyString())).thenReturn(1L);

        limiter.increment("reset:ip:1.2.3.4", HOUR);

        String expected = new OpenframeRedisKeyBuilder(new OpenframeRedisProperties()).globalKey("auth-limit:reset:ip:1.2.3.4");
        verify(values).increment(expected);
        verify(redisTemplate).expire(expected, HOUR);
    }
}
