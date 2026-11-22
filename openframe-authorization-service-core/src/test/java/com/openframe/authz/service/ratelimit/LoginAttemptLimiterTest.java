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
        lenient().when(rateLimiter.increment(anyString(), eq(WINDOW))).thenReturn(1L);
    }

    @Test
    void tryAcquire_reservesTheAttemptOnAccountAndIp() {
        assertThat(limiter.tryAcquire("t1", "ada@acme.com", "1.2.3.4")).isTrue();

        verify(rateLimiter).increment(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter).increment(contains("ip:1.2.3.4"), eq(WINDOW));
    }

    @Test
    void tryAcquire_tenthAttempt_allowedAndStartsTheBlock(CapturedOutput output) {
        when(rateLimiter.increment(contains("account:"), eq(WINDOW))).thenReturn(10L);

        assertThat(limiter.tryAcquire("t1", "ada@acme.com", "1.2.3.4")).isTrue();

        verify(rateLimiter).restartWindow(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        assertThat(output).contains("event=password_login_blocked", "scope=account", "tenantId=t1", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void tryAcquire_eleventhAttempt_refusedWithoutExtendingTheBlock() {
        when(rateLimiter.increment(contains("account:"), eq(WINDOW))).thenReturn(11L);

        assertThat(limiter.tryAcquire("t1", "ada@acme.com", "1.2.3.4")).isFalse();

        verify(rateLimiter, never()).restartWindow(anyString(), eq(WINDOW));
    }

    @Test
    void tryAcquire_fiftiethFromIp_allowedAndStartsTheIpBlock(CapturedOutput output) {
        when(rateLimiter.increment(contains("ip:"), eq(WINDOW))).thenReturn(50L);

        assertThat(limiter.tryAcquire("t2", "bob@other.com", "1.2.3.4")).isTrue();

        verify(rateLimiter).restartWindow(contains("ip:1.2.3.4"), eq(WINDOW));
        assertThat(output).contains("event=password_login_blocked", "scope=ip");
    }

    @Test
    void tryAcquire_fiftyFirstFromIp_refusedForAnyAccount() {
        when(rateLimiter.increment(contains("ip:"), eq(WINDOW))).thenReturn(51L);

        assertThat(limiter.tryAcquire("t2", "bob@other.com", "1.2.3.4")).isFalse();
    }

    @Test
    void tryAcquire_belowBothThresholds_noBlockStarted() {
        when(rateLimiter.increment(anyString(), eq(WINDOW))).thenReturn(9L);

        assertThat(limiter.tryAcquire("t1", "ada@acme.com", "1.2.3.4")).isTrue();

        verify(rateLimiter, never()).restartWindow(anyString(), eq(WINDOW));
    }

    @Test
    void tryAcquire_noIp_onlyTheAccountCounts() {
        assertThat(limiter.tryAcquire("t1", "ada@acme.com", null)).isTrue();

        verify(rateLimiter, never()).increment(contains("ip:"), eq(WINDOW));
    }

    @Test
    void accountKey_isTenantPlusEmailHash_emailNormalized() {
        limiter.tryAcquire("t1", "Ada@Acme.COM", null);

        verify(rateLimiter).increment(contains("account:t1:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter, never()).increment(contains("ada@acme.com"), eq(WINDOW));
    }

    @Test
    void accountKey_sameEmailInAnotherTenant_countsSeparately() {
        limiter.tryAcquire("t2", "ada@acme.com", null);

        verify(rateLimiter).increment(contains("account:t2:" + EMAIL_HASH), eq(WINDOW));
        verify(rateLimiter, never()).increment(contains("account:t1:"), eq(WINDOW));
    }

    @Test
    void onSuccess_clearsTheAccountAndGivesTheIpAttemptBack() {
        limiter.onSuccess("t1", "Ada@acme.com", "1.2.3.4");

        verify(rateLimiter).clear(contains("account:t1:" + EMAIL_HASH));
        verify(rateLimiter).decrement(contains("ip:1.2.3.4"));
    }

    @Test
    void release_givesBothAttemptsBack() {
        limiter.release("t1", "ada@acme.com", "1.2.3.4");

        verify(rateLimiter).decrement(contains("account:t1:" + EMAIL_HASH));
        verify(rateLimiter).decrement(contains("ip:1.2.3.4"));
    }

    @Test
    void releaseAndSuccess_noIp_touchOnlyTheAccount() {
        limiter.release("t1", "ada@acme.com", null);
        limiter.onSuccess("t1", "ada@acme.com", null);

        verify(rateLimiter, never()).decrement(contains("ip:"));
    }

    @Test
    void clearAccount_dropsTheAccountCounter() {
        limiter.clearAccount("t1", "Ada@acme.com");

        verify(rateLimiter).clear(contains("account:t1:" + EMAIL_HASH));
    }
}
