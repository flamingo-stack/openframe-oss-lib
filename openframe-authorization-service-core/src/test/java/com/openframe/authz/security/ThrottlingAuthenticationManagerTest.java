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
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

class ThrottlingAuthenticationManagerTest {

    private static final String TENANT = "t1";
    private static final String EMAIL = "ada@acme.com";
    private static final String PASSWORD = "R1ght-password";

    private final InMemoryRateLimiter counters = new InMemoryRateLimiter();
    private boolean refuseTenant;
    private ThrottlingAuthenticationManager manager;

    @BeforeEach
    void setUp() {
        UserDetailsService users = username -> {
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
        manager = new ThrottlingAuthenticationManager(new ProviderManager(provider),
                new LoginAttemptLimiter(counters, 10, 50, Duration.ofMinutes(15)));
        TenantContext.setTenantId(TENANT);
        fromIp("1.2.3.4");
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
        fromIp("5.6.7.8");

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
    void unknownEmail_failuresCountLikeAKnownOne() {
        failTimes("ghost@acme.com", 10);

        assertThat(counters.values()).contains(10L);
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
    void blocked_failedAttemptsDoNotExtendTheBlock() {
        failTimes(EMAIL, 10);
        long before = counters.total();

        failTimes(EMAIL, 5);

        assertThat(counters.total()).isEqualTo(before);
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

    private static void fromIp(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    /** The limiter's Redis replaced by a map; TTLs are covered by AuthRateLimiterIT. */
    private static final class InMemoryRateLimiter extends AuthRateLimiter {

        private final Map<String, Long> counts = new HashMap<>();

        InMemoryRateLimiter() {
            super(null, null);
        }

        @Override
        public long increment(String relativeKey, Duration window) {
            return counts.merge(relativeKey, 1L, Long::sum);
        }

        @Override
        public long count(String relativeKey) {
            return counts.getOrDefault(relativeKey, 0L);
        }

        @Override
        public void restartWindow(String relativeKey, Duration window) {
            // no TTLs in memory
        }

        @Override
        public void clear(String relativeKey) {
            counts.remove(relativeKey);
        }

        java.util.Collection<Long> values() {
            return counts.values();
        }

        long total() {
            return counts.values().stream().mapToLong(Long::longValue).sum();
        }
    }
}
