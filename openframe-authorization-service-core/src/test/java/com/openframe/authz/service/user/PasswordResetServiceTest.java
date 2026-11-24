package com.openframe.authz.service.user;

import com.openframe.authz.service.auth.MongoAuthorizationService;
import com.openframe.authz.service.ratelimit.AuthRateLimiter;
import com.openframe.authz.service.ratelimit.LoginAttemptLimiter;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.core.exception.AuthFlowException;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static com.openframe.authz.support.TestHashes.sha256;
import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.core.exception.AuthErrorCode.PASSWORD_LOGIN_DISABLED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class PasswordResetServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private ValueOperations<String, String> values;
    @Mock
    private UserService userService;
    @Mock
    private EmailService emailService;
    @Mock
    private MongoAuthorizationService authorizationService;
    @Mock
    private SSOConfigService ssoConfigService;
    @Mock
    private AuthRateLimiter rateLimiter;
    @Mock
    private LoginAttemptLimiter loginAttemptLimiter;

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        props.setTenantId("t1");
        service = new PasswordResetService(redisTemplate, props, new OpenframeRedisKeyBuilder(props),
                userService, emailService, authorizationService, ssoConfigService, rateLimiter, loginAttemptLimiter);
        ReflectionTestUtils.setField(service, "ttlMinutes", 30);
        ReflectionTestUtils.setField(service, "maxRequestsPerEmail", 3);
        ReflectionTestUtils.setField(service, "maxRequestsPerIp", 10);
        lenient().when(redisTemplate.opsForValue()).thenReturn(values);
        lenient().when(rateLimiter.increment(anyString(), any(Duration.class))).thenReturn(0L);
        lenient().when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void shouldStoreRandomTokenWithTtlAndEmailIt() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
        verify(values).set(key.capture(), eq("ada@acme.com"), eq(Duration.ofMinutes(30)));
        verify(emailService).sendPasswordResetEmail(eq("ada@acme.com"), token.capture());
        assertThat(token.getValue()).matches("^[A-Za-z0-9_-]{43}$");
        assertThat(key.getValue()).contains("pwdreset:" + token.getValue());
    }

    @Test
    void shouldDoNothingVisibleForUnknownEmail() {
        when(userService.findActiveTenantIdsByEmail("ghost@acme.com")).thenReturn(List.of());

        service.createResetToken("ghost@acme.com");

        verifyNoInteractions(emailService);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void shouldChangePasswordRevokeSessionsAndBurnToken() {
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u-1", "t", "ada@acme.com")));

        service.resetPassword("token-1", "N3w-password!");

        verify(userService).updatePassword("u-1", "N3w-password!");
        verify(authorizationService).revokeAllForPrincipal("ada@acme.com");
        verify(redisTemplate).delete(org.mockito.ArgumentMatchers.contains("token-1"));
    }

    @Test
    void shouldRejectUnknownOrExpiredToken() {
        when(values.get(anyString())).thenReturn(null);

        assertThatThrownBy(() -> service.resetPassword("random", "N3w-password!"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid or expired reset token");
        verify(userService, never()).updatePassword(any(), any());
    }

    @Test
    void shouldRejectTokenOfUserDeactivatedSinceRequest() {
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword("token-1", "N3w-password!"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(userService, never()).updatePassword(any(), any());
    }

    @Test
    void shouldSendNothingWhenOpenframeLoginIsOff() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(false);

        service.createResetToken("ada@acme.com");

        verifyNoInteractions(emailService);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void shouldRefuseTokenIssuedBeforeOpenframeLoginWasTurnedOff() {
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u1", "t1", "ada@acme.com")));
        doThrow(new AuthFlowException(PASSWORD_LOGIN_DISABLED, PASSWORD_LOGIN_DISABLED.getMessage()))
                .when(ssoConfigService).refuseUnlessOpenframeLoginEnabled("t1");

        assertThatThrownBy(() -> service.resetPassword("token-1", "N3w-password!"))
                .isInstanceOf(AuthFlowException.class);
        verify(userService, never()).updatePassword(any(), any());
    }

    // --- request limits (CU-17tkuw68zpq) ---

    private static final Duration HOUR = Duration.ofHours(1);
    private static final String ADA_HASH = sha256("ada@acme.com");

    @Test
    void createResetToken_fourthRequestForEmail_sendsNothing() {
        fromIp("1.2.3.4");
        when(rateLimiter.increment(contains("email:" + ADA_HASH), eq(HOUR))).thenReturn(4L);

        service.createResetToken("ada@acme.com");

        verifyNoInteractions(emailService);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void createResetToken_thirdRequestForEmail_stillSends() {
        fromIp("1.2.3.4");
        when(rateLimiter.increment(contains("email:" + ADA_HASH), eq(HOUR))).thenReturn(3L);
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        verify(emailService).sendPasswordResetEmail(eq("ada@acme.com"), anyString());
    }

    @Test
    void createResetToken_eleventhRequestFromIp_sendsNothing() {
        fromIp("1.2.3.4");
        when(rateLimiter.increment(contains("ip:1.2.3.4"), eq(HOUR))).thenReturn(11L);

        service.createResetToken("ada@acme.com");

        verifyNoInteractions(emailService);
    }

    @Test
    void createResetToken_tenthRequestFromIp_stillSends() {
        fromIp("1.2.3.4");
        when(rateLimiter.increment(contains("ip:1.2.3.4"), eq(HOUR))).thenReturn(10L);
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        verify(emailService).sendPasswordResetEmail(eq("ada@acme.com"), anyString());
    }

    @Test
    void createResetToken_noClientIp_ipLimitNotApplied() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        verify(rateLimiter, never()).increment(contains("ip:"), any(Duration.class));
        verify(emailService).sendPasswordResetEmail(eq("ada@acme.com"), anyString());
    }

    @Test
    void createResetToken_limitKeyHoldsEmailHashNotEmail() {
        service.createResetToken("ada@acme.com");

        verify(rateLimiter).increment(contains("email:" + ADA_HASH), eq(HOUR));
        verify(rateLimiter, never()).increment(contains("ada@acme.com"), any(Duration.class));
    }

    @Test
    void createResetToken_unknownEmail_stillCounted() {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ghost@acme.com")).thenReturn(List.of());

        service.createResetToken("ghost@acme.com");

        verify(rateLimiter).increment(contains("email:" + sha256("ghost@acme.com")), eq(HOUR));
        verify(rateLimiter).increment(contains("ip:1.2.3.4"), eq(HOUR));
    }

    @Test
    void createResetToken_loginDisabled_stillCounted() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(false);

        service.createResetToken("ada@acme.com");

        verify(rateLimiter).increment(contains("email:" + ADA_HASH), eq(HOUR));
    }

    @Test
    void createResetToken_tokenStillValid_sendsNothingNewTokenNotIssued() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        when(values.setIfAbsent(contains("active:" + ADA_HASH), anyString(), any(Duration.class))).thenReturn(false);

        service.createResetToken("ada@acme.com");

        verifyNoInteractions(emailService);
        verify(values, never()).set(anyString(), anyString(), any(Duration.class));
    }

    @Test
    void createResetToken_tokenIssued_marksEmailActiveForTokenTtlByHash() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(values).setIfAbsent(key.capture(), anyString(), eq(Duration.ofMinutes(30)));
        assertThat(key.getValue()).contains("active:" + ADA_HASH).doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_claimsTheActiveMarkBeforeSending_soParallelRequestsSendOnce() {
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        InOrder order = inOrder(values, emailService);
        order.verify(values).setIfAbsent(contains("active:" + ADA_HASH), anyString(), any(Duration.class));
        order.verify(emailService).sendPasswordResetEmail(eq("ada@acme.com"), anyString());
    }

    @Test
    void resetPassword_success_dropsActiveMarkAndClearsLoginCounter() {
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u-1", "t", "ada@acme.com")));

        service.resetPassword("token-1", "N3w-password!");

        verify(redisTemplate).delete(contains("active:" + ADA_HASH));
        verify(loginAttemptLimiter).clearAccount("t", "ada@acme.com");
    }

    // --- structured logs (CU-17tkuw68zpq) ---

    @Test
    void createResetToken_sent_logsOutcomeTenantsAndIpWithoutEmail(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);

        service.createResetToken("ada@acme.com");

        assertThat(output).contains("event=password_reset_request", "outcome=sent", "tenantIds=[t1]", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_unknownEmail_logsOutcomeWithoutEmail(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ghost@acme.com")).thenReturn(List.of());

        service.createResetToken("ghost@acme.com");

        assertThat(output).contains("event=password_reset_request", "outcome=unknown_email", "ip=1.2.3.4")
                .doesNotContain("ghost@acme.com");
    }

    @Test
    void createResetToken_loginDisabled_logsOutcome(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(false);

        service.createResetToken("ada@acme.com");

        assertThat(output).contains("event=password_reset_request", "outcome=login_disabled", "tenantIds=[t1]",
                "ip=1.2.3.4").doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_tokenActive_logsOutcome(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        when(values.setIfAbsent(contains("active:"), anyString(), any(Duration.class))).thenReturn(false);

        service.createResetToken("ada@acme.com");

        assertThat(output).contains("event=password_reset_request", "outcome=token_active", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_rateLimited_logsOutcome(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(rateLimiter.increment(contains("email:"), eq(HOUR))).thenReturn(4L);

        service.createResetToken("ada@acme.com");

        assertThat(output).contains("event=password_reset_request", "outcome=rate_limited", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void resetPassword_success_logsUserTenantAndIp(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u-1", "t", "ada@acme.com")));

        service.resetPassword("token-1", "N3w-password!");

        assertThat(output).contains("event=password_reset_confirm", "outcome=success", "userId=u-1", "tenantId=t",
                "ip=1.2.3.4").doesNotContain("ada@acme.com");
    }

    @Test
    void resetPassword_invalidToken_logsOutcome(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(values.get(anyString())).thenReturn(null);

        assertThatThrownBy(() -> service.resetPassword("random", "N3w-password!"));

        assertThat(output).contains("event=password_reset_confirm", "outcome=invalid_token", "ip=1.2.3.4");
    }

    @Test
    void resetPassword_userGone_logsOutcomeWithoutEmail(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetPassword("token-1", "N3w-password!"));

        assertThat(output).contains("event=password_reset_confirm", "outcome=user_not_found", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void resetPassword_loginDisabled_logsOutcome(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u1", "t1", "ada@acme.com")));
        doThrow(new AuthFlowException(PASSWORD_LOGIN_DISABLED, PASSWORD_LOGIN_DISABLED.getMessage()))
                .when(ssoConfigService).refuseUnlessOpenframeLoginEnabled("t1");

        assertThatThrownBy(() -> service.resetPassword("token-1", "N3w-password!"));

        assertThat(output).contains("event=password_reset_confirm", "outcome=login_disabled", "userId=u1",
                "tenantId=t1", "ip=1.2.3.4").doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_emailSendFails_quiet202LogsSendFailedAndSetsNoActiveMark(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        doThrow(new IllegalStateException("HubSpot API error: status=503"))
                .when(emailService).sendPasswordResetEmail(eq("ada@acme.com"), anyString());

        assertThatCode(() -> service.createResetToken("ada@acme.com")).doesNotThrowAnyException();

        verify(redisTemplate).delete(contains("active:" + ADA_HASH));
        assertThat(output).contains("event=password_reset_request", "outcome=send_failed", "tenantIds=[t1]",
                "ip=1.2.3.4").doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_tokenWriteFails_quiet202DropsActiveMarkSendsNothing(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        doThrow(new IllegalStateException("Redis down"))
                .when(values).set(anyString(), eq("ada@acme.com"), any(Duration.class));

        assertThatCode(() -> service.createResetToken("ada@acme.com")).doesNotThrowAnyException();

        verify(redisTemplate).delete(contains("active:" + ADA_HASH));
        verifyNoInteractions(emailService);
        assertThat(output).contains("event=password_reset_request", "outcome=send_failed", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_redisDownOnActiveMark_quiet202SendsNothing(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenThrow(new IllegalStateException("Redis down"));

        assertThatCode(() -> service.createResetToken("ada@acme.com")).doesNotThrowAnyException();

        verifyNoInteractions(emailService);
        assertThat(output).contains("event=password_reset_request", "outcome=redis_unavailable", "tenantIds=[t1]",
                "ip=1.2.3.4").doesNotContain("ada@acme.com");
    }

    @Test
    void createResetToken_redisStaysDownAfterClaim_quiet202LogsSendFailed(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(userService.findActiveTenantIdsByEmail("ada@acme.com")).thenReturn(List.of("t1"));
        when(ssoConfigService.isOpenframeLoginEnabled("t1")).thenReturn(true);
        doThrow(new IllegalStateException("Redis down"))
                .when(values).set(anyString(), eq("ada@acme.com"), any(Duration.class));
        when(redisTemplate.delete(anyString())).thenThrow(new IllegalStateException("Redis down"));

        assertThatCode(() -> service.createResetToken("ada@acme.com")).doesNotThrowAnyException();

        verifyNoInteractions(emailService);
        assertThat(output).contains("event=password_reset_request", "outcome=send_failed", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
    }

    @Test
    void resetPassword_duplicateActiveAccounts_logsLookupFailedAndRethrows(CapturedOutput output) {
        fromIp("1.2.3.4");
        when(values.get(anyString())).thenReturn("ada@acme.com");
        when(userService.findActiveByEmail("ada@acme.com"))
                .thenThrow(new IllegalStateException("active accounts in more than one organization"));

        assertThatThrownBy(() -> service.resetPassword("token-1", "N3w-password!"))
                .isInstanceOf(IllegalStateException.class);

        assertThat(output).contains("event=password_reset_confirm", "outcome=lookup_failed", "ip=1.2.3.4")
                .doesNotContain("ada@acme.com");
        verify(userService, never()).updatePassword(anyString(), anyString());
    }

    private static void fromIp(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
