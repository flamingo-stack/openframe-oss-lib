package com.openframe.authz.service.auth;

import com.openframe.data.redis.OpenframeRedisKeyBuilder;
import com.openframe.data.redis.OpenframeRedisProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static com.openframe.authz.support.SsoTestFixtures.objectMapper;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_NOT_FOUND;
import static com.openframe.core.exception.AuthErrorCode.PROVIDER_ERROR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthErrorDetailStoreTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private ValueOperations<String, String> values;

    private OpenframeRedisKeyBuilder keyBuilder;
    private AuthErrorDetailStore store;

    @BeforeEach
    void setUp() {
        OpenframeRedisProperties props = new OpenframeRedisProperties();
        props.setTenantId("shared");
        keyBuilder = new OpenframeRedisKeyBuilder(props);
        store = new AuthErrorDetailStore(redisTemplate, keyBuilder, objectMapper());
        when(redisTemplate.opsForValue()).thenReturn(values);
    }

    @Test
    void shouldStoreCodeAndMessageForFiveMinutesBehindSupportFriendlyReference() {
        String reference = store.save(PROVIDER_ERROR, "AADSTS50020: User account does not exist");

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(values).set(eq(keyFor(reference)), json.capture(), eq(Duration.ofMinutes(5)));
        assertThat(reference).matches("^[A-HJ-NP-Z2-9]{8}$");
        assertThat(json.getValue())
                .contains("\"code\":\"PROVIDER_ERROR\"")
                .contains("\"message\":\"AADSTS50020: User account does not exist\"");
    }

    @Test
    void shouldFindStoredDetailWithoutConsumingIt() {
        when(values.get(keyFor("ref"))).thenReturn(
                "{\"code\":\"ACCOUNT_NOT_FOUND\",\"message\":\"No account found for a@acme.com.\"}");

        assertThat(store.find("ref")).hasValueSatisfying(detail -> {
            assertThat(detail.getCode()).isEqualTo(ACCOUNT_NOT_FOUND);
            assertThat(detail.getMessage()).isEqualTo("No account found for a@acme.com.");
        });
        verify(values, never()).getAndDelete(anyString());
        verify(redisTemplate, never()).delete(anyString());
    }

    @Test
    void shouldReturnEmptyForUnknownReference() {
        when(values.get(keyFor("gone"))).thenReturn(null);

        assertThat(store.find("gone")).isEmpty();
    }

    private String keyFor(String reference) {
        return keyBuilder.tenantKey("auth:error:" + reference);
    }
}
