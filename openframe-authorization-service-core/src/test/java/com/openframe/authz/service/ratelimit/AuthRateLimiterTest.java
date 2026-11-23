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
import org.springframework.data.redis.core.script.RedisScript;

import java.time.Duration;
import java.util.List;

import static com.openframe.authz.support.TestHashes.sha256;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class AuthRateLimiterTest {

    private static final Duration HOUR = Duration.ofHours(1);
    private static final String KEY = new OpenframeRedisKeyBuilder(new OpenframeRedisProperties())
            .globalKey("auth-limit:reset:ip:1.2.3.4");

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    private AuthRateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new AuthRateLimiter(redisTemplate, new OpenframeRedisKeyBuilder(new OpenframeRedisProperties()));
    }

    @Test
    void increment_runsOneAtomicScriptOnTheGlobalKeyWithTheWindowInSeconds() {
        when(redisTemplate.execute(any(RedisScript.class), eq(List.of(KEY)), eq("3600"))).thenReturn(2L);

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isEqualTo(2L);
    }

    @Test
    void increment_redisDown_failsOpenWithWarn(CapturedOutput output) {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), anyString()))
                .thenThrow(new RedisConnectionFailureException("down"));

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isZero();
        assertThat(output).contains("WARN");
    }

    @Test
    void increment_scriptReturnsNothing_isZero() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), anyString())).thenReturn(null);

        assertThat(limiter.increment("reset:ip:1.2.3.4", HOUR)).isZero();
    }

    @Test
    void decrement_runsAScriptOnTheGlobalKey() {
        limiter.decrement("reset:ip:1.2.3.4");

        verify(redisTemplate).execute(any(RedisScript.class), eq(List.of(KEY)));
    }

    @Test
    void decrement_redisDown_doesNotThrow(CapturedOutput output) {
        when(redisTemplate.execute(any(RedisScript.class), anyList()))
                .thenThrow(new RedisConnectionFailureException("down"));

        assertThatCode(() -> limiter.decrement("reset:ip:1.2.3.4")).doesNotThrowAnyException();
        assertThat(output).contains("WARN");
    }

    @Test
    void restartWindow_setsTheTtlOnTheGlobalKey() {
        limiter.restartWindow("reset:ip:1.2.3.4", HOUR);

        verify(redisTemplate).expire(KEY, HOUR);
    }

    @Test
    void clear_deletesTheGlobalKey() {
        limiter.clear("reset:ip:1.2.3.4");

        verify(redisTemplate).delete(KEY);
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
}
