package com.openframe.authz.security;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.ratelimit.AuthRateLimiter;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter;
import com.openframe.core.exception.AuthErrorCode;
import com.openframe.core.exception.AuthFlowException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

class ThrottlingAuthenticationManagerTest {

    private static final String TENANT = "t1";
    private static final String EMAIL = "ada@acme.com";
    private static final String PASSWORD = "R1ght-password";

    private final InMemoryRateLimiter counters = new InMemoryRateLimiter();
    private final CountingEncoder encoder = new CountingEncoder();
    private final AtomicInteger userLookups = new AtomicInteger();
    private volatile boolean refuseTenant;
    private volatile long lookupDelayMillis;
    private ThrottlingAuthenticationManager manager;

    @BeforeEach
    void setUp() {
        UserDetailsService users = username -> {
            userLookups.incrementAndGet();
            pause(lookupDelayMillis);
            if (refuseTenant) {
                throw new AuthFlowException(AuthErrorCode.PASSWORD_LOGIN_DISABLED,
                        AuthErrorCode.PASSWORD_LOGIN_DISABLED.getMessage());
            }
            if (!EMAIL.equals(username)) {
                throw new UsernameNotFoundException("User not found: " + username);
            }
            return User.withUsername(EMAIL).password("{noop}" + PASSWORD).roles("USER").build();
        };
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        manager = new ThrottlingAuthenticationManager(new ProviderManager(provider),
                new LoginAttemptLimiter(counters, 10, 50, Duration.ofMinutes(15)), encoder);
        enter("1.2.3.4");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void tenFailures_thenRightPassword_refusedLikeAWrongPassword() {
        failTimes(EMAIL, 10);

        assertThatThrownBy(() -> login(EMAIL, PASSWORD)).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void nineFailures_thenRightPassword_loginSucceeds() {
        failTimes(EMAIL, 9);

        assertThat(login(EMAIL, PASSWORD).isAuthenticated()).isTrue();
    }

    @Test
    void fiftyFailuresFromOneIp_anyAccountFromThatIpRefused() {
        for (int i = 0; i < 50; i++) {
            fail("ghost" + i + "@acme.com");
        }

        assertThatThrownBy(() -> login(EMAIL, PASSWORD)).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void fiftyFailuresFromOneIp_otherIpStillLogsIn() {
        for (int i = 0; i < 50; i++) {
            fail("ghost" + i + "@acme.com");
        }
        enter("5.6.7.8");

        assertThat(login(EMAIL, PASSWORD).isAuthenticated()).isTrue();
    }

    @Test
    void successfulLogins_doNotUseUpTheIpLimit() {
        for (int i = 0; i < 60; i++) {
            login(EMAIL, PASSWORD);
        }

        assertThat(login(EMAIL, PASSWORD).isAuthenticated()).isTrue();
    }

    @Test
    void blockedRefusal_isIdenticalToAWrongPassword_forKnownAndUnknownEmail() {
        BadCredentialsException wrongPassword = catchThrowableOfType(BadCredentialsException.class,
                () -> login(EMAIL, "wrong"));
        failTimes(EMAIL, 10);
        failTimes("ghost@acme.com", 10);

        BadCredentialsException blockedKnown = catchThrowableOfType(BadCredentialsException.class,
                () -> login(EMAIL, PASSWORD));
        BadCredentialsException blockedUnknown = catchThrowableOfType(BadCredentialsException.class,
                () -> login("ghost@acme.com", PASSWORD));

        assertThat(blockedKnown).hasSameClassAs(wrongPassword).hasMessage(wrongPassword.getMessage());
        assertThat(blockedUnknown).hasSameClassAs(wrongPassword).hasMessage(wrongPassword.getMessage());
    }

    @Test
    void blockedRefusal_stillRunsOnePasswordCheck_soItIsNotFaster() {
        failTimes(EMAIL, 10);
        int before = encoder.matches.get();
        int lookupsBefore = userLookups.get();

        fail(EMAIL);

        assertThat(encoder.matches.get()).isEqualTo(before + 1);
        assertThat(userLookups.get()).isEqualTo(lookupsBefore);
    }

    @Test
    void unknownEmail_isBlockedLikeAKnownOne() {
        failTimes("ghost@acme.com", 10);
        int lookupsBefore = userLookups.get();

        fail("ghost@acme.com");

        assertThat(userLookups.get()).isEqualTo(lookupsBefore);
    }

    @Test
    void tenantRefusal_isNotCountedAsAFailure() {
        refuseTenant = true;

        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> login(EMAIL, PASSWORD)).isInstanceOf(InternalAuthenticationServiceException.class);
        }
        refuseTenant = false;

        assertThat(login(EMAIL, PASSWORD).isAuthenticated()).isTrue();
    }

    @Test
    void successfulLogin_clearsTheAccountCounter() {
        failTimes(EMAIL, 9);
        login(EMAIL, PASSWORD);
        failTimes(EMAIL, 9);

        assertThat(login(EMAIL, PASSWORD).isAuthenticated()).isTrue();
    }

    @Test
    void blocked_attemptsDoNotExtendTheBlock() {
        failTimes(EMAIL, 10);
        int restartsBefore = counters.restarts.get();

        failTimes(EMAIL, 5);

        assertThat(counters.restarts.get()).isEqualTo(restartsBefore);
    }

    @Test
    void concurrentWrongPasswords_checkAtMostTheLimit() throws Exception {
        lookupDelayMillis = 30;
        int attempts = 30;
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        try {
            List<Callable<Void>> tasks = IntStream.range(0, attempts).<Callable<Void>>mapToObj(i -> () -> {
                enter("1.2.3.4");
                start.await();
                try {
                    login(EMAIL, "wrong");
                } catch (AuthenticationException expected) {
                    // every attempt fails; only how many reached the password check matters
                }
                return null;
            }).toList();
            var futures = tasks.stream().map(pool::submit).toList();
            start.countDown();
            for (var future : futures) {
                future.get();
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(userLookups.get()).isLessThanOrEqualTo(10);
    }

    private Authentication login(String email, String password) {
        return manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, password));
    }

    private void failTimes(String email, int times) {
        for (int i = 0; i < times; i++) {
            fail(email);
        }
    }

    private void fail(String email) {
        assertThatThrownBy(() -> login(email, "wrong")).isInstanceOf(AuthenticationException.class);
    }

    private static void enter(String ip) {
        TenantContext.setTenantId(TENANT);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private static void pause(long millis) {
        if (millis == 0) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static final class CountingEncoder implements PasswordEncoder {

        private final PasswordEncoder delegate = PasswordEncoderFactories.createDelegatingPasswordEncoder();
        private final AtomicInteger matches = new AtomicInteger();

        @Override
        public String encode(CharSequence rawPassword) {
            return delegate.encode(rawPassword);
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            matches.incrementAndGet();
            return delegate.matches(rawPassword, encodedPassword);
        }
    }

    /** The limiter's Redis replaced by a map; TTLs and atomicity in Redis are covered by AuthRateLimiterIT. */
    private static final class InMemoryRateLimiter extends AuthRateLimiter {

        private final Map<String, Long> counts = new ConcurrentHashMap<>();
        private final AtomicInteger restarts = new AtomicInteger();

        InMemoryRateLimiter() {
            super(null, null);
        }

        @Override
        public long increment(String relativeKey, Duration window) {
            return counts.merge(relativeKey, 1L, Long::sum);
        }

        @Override
        public void decrement(String relativeKey) {
            counts.computeIfPresent(relativeKey, (key, count) -> count - 1);
        }

        @Override
        public void restartWindow(String relativeKey, Duration window) {
            restarts.incrementAndGet();
        }

        @Override
        public void clear(String relativeKey) {
            counts.remove(relativeKey);
        }
    }
}
