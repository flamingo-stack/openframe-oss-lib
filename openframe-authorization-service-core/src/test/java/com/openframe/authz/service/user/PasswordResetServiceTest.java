package com.openframe.authz.service.user;

import com.openframe.authz.service.auth.MongoAuthorizationService;
import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
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

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        props.setTenantId("t1");
        service = new PasswordResetService(redisTemplate, props, new OpenframeRedisKeyBuilder(props),
                userService, emailService, authorizationService);
        ReflectionTestUtils.setField(service, "ttlMinutes", 30);
        lenient().when(redisTemplate.opsForValue()).thenReturn(values);
    }

    @Test
    void shouldStoreRandomTokenWithTtlAndEmailIt() {
        when(userService.findActiveByEmail("ada@acme.com")).thenReturn(Optional.of(activeUser("u", "t", "ada@acme.com")));

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
        when(userService.findActiveByEmail("ghost@acme.com")).thenReturn(Optional.empty());

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
}
