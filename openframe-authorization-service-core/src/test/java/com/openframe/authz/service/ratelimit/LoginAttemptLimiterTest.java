package com.openframe.authz.service.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.time.Duration;

import static com.openframe.authz.support.TestHashes.sha256;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class LoginAttemptLimiterTest {

    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final String EMAIL_HASH = sha256("ada@acme.com");

    @Mock
    private AuthRateLimiter rateLimiter;

    private LoginAttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new LoginAttemptLimiter(rateLimiter, 10, 50, WINDOW);
        lenient().when(rateLimiter.count(anyString())).thenReturn(0L);
    }

    @Test
    void isBlocked_tenFailuresOnTheAccount_blocked() {
        when(rateLimiter.count(contains("account:t1:" + EMAIL_HASH))).thenReturn(10L);

        assertThat(limiter.isBlocked("t1", "ada@acme.com", "1.2.3.4")).isTrue();
    }

    @Test
    void isBlocked_nineFailuresOnTheAccount_notBlocked() {
        when(rateLimiter.count(contains("account:t1:" + EMAIL_HASH))).thenReturn(9L);

        assertThat(limiter.isBlocked("t1", "ada@acme.com", "1.2.3.4")).isFalse();
    }

    @Test
    void isBlocked_fiftyFailuresFromTheIp_blocksAnyAccount() {
        when(rateLimiter.count(contains("ip:1.2.3.4"))).thenReturn(50L);

        assertThat(limiter.isBlocked("t2", "bob@other.com", "1.2.3.4")).isTrue();
    }

    @Test
    void isBlocked_fortyNineFailuresFromTheIp_notBlocked() {
        when(rateLimiter.count(contains("ip:1.2.3.4"))).thenReturn(49L);

        assertThat(limiter.isBlocked("t2", "bob@other.com", "1.2.3.4")).isFalse();
    }

    @Test
    void isBlocked_noIp_onlyTheAccountCounts() {
        assertThat(limiter.isBlocked("t1", "ada@acme.com", null)).isFalse();

        verify(rateLimiter, never()).count(contains("ip:"));
    }

    @Test
    void accountKey_isTenantPlusEmailHash_emailNormalized() {
        limiter.recordFailure("t1", "Ada@Acme.COM", null);

        verify(rateLimiter).increment(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter, never()).increment(contains("ada@acme.com"), eq(WINDOW));
    }

    @Test
    void accountKey_sameEmailInAnotherTenant_countsSeparately() {
        limiter.recordFailure("t2", "ada@acme.com", null);

        verify(rateLimiter).increment(contains("account:t2:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter, never()).increment(contains("account:t1:"), eq(WINDOW));
    }

    @Test
    void recordFailure_countsAccountAndIp() {
        limiter.recordFailure("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter).increment(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter).increment(contains("ip:1.2.3.4"), eq(WINDOW));
    }

    @Test
    void recordFailure_tenthFailure_startsTheBlockAndWarnsWithoutEmail(CapturedOutput output) {
        when(rateLimiter.increment(contains("account:"), eq(WINDOW))).thenReturn(10L);

        limiter.recordFailure("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter).restartWindow(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        assertThat(output).contains("event=password_login_blocked", "scope=account", "tenantId=t1", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void recordFailure_fiftiethIpFailure_startsTheIpBlock(CapturedOutput output) {
        when(rateLimiter.increment(contains("ip:"), eq(WINDOW))).thenReturn(50L);

        limiter.recordFailure("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter).restartWindow(contains("ip:1.2.3.4"), eq(WINDOW));
        assertThat(output).contains("event=password_login_blocked", "scope=ip");
    }

    @Test
    void recordFailure_belowTheThreshold_doesNotRestartTheWindow() {
        when(rateLimiter.increment(anyString(), eq(WINDOW))).thenReturn(9L);

        limiter.recordFailure("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter, never()).restartWindow(anyString(), eq(WINDOW));
    }

    @Test
    void recordFailure_whileBlocked_doesNotExtendTheBlock() {
        when(rateLimiter.count(contains("account:"))).thenReturn(10L);
        when(rateLimiter.count(contains("ip:"))).thenReturn(50L);

        limiter.recordFailure("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter, never()).increment(anyString(), eq(WINDOW));
        verify(rateLimiter, never()).restartWindow(anyString(), eq(WINDOW));
    }

    @Test
    void clearAccount_dropsTheAccountCounter() {
        limiter.clearAccount("t1", "Ada@acme.com");

        verify(rateLimiter).clear(contains("account:t1:" + EMAIL_HASH));
    }
}
