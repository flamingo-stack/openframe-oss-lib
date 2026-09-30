package com.openframe.gateway.service;

import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import reactor.core.publisher.Mono;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ApiKeyValidationServiceTest {

    private static final String KEY_ID = "ak_12345678abc";
    private static final String SECRET = "0123456789abcdefSECRET";
    private static final String FULL_KEY = KEY_ID + ".sk_" + SECRET;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final ReactiveApiKeyRepository repository = mock(ReactiveApiKeyRepository.class);
    private final ApiKeyStatsService stats = mock(ApiKeyStatsService.class);
    private ApiKeyValidationService service;

    @BeforeEach
    void setUp() {
        service = new ApiKeyValidationService(repository, encoder, stats);
    }

    private ApiKey key(boolean enabled, Instant expiresAt) {
        return ApiKey.builder().keyId(KEY_ID).userId("user-1").tenantId("t").hashedKey(encoder.encode(SECRET))
                .enabled(enabled).expiresAt(expiresAt).build();
    }

    private ApiKeyValidationService.ApiKeyValidationResult validate(String fullKey) {
        return service.validateApiKey(fullKey, "t").block();
    }

    @Test
    void shouldAcceptActiveKeyWithMatchingSecret() {
        ApiKey stored = key(true, Instant.now().plusSeconds(3600));
        when(repository.findById(KEY_ID)).thenReturn(Mono.just(stored));

        ApiKeyValidationService.ApiKeyValidationResult result = validate(FULL_KEY);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getApiKey()).isSameAs(stored);
        verify(stats, never()).incrementFailed(anyString(), anyString());
    }

    @Test
    void shouldRejectWrongSecretAndCountFailure() {
        when(repository.findById(KEY_ID)).thenReturn(Mono.just(key(true, null)));

        ApiKeyValidationService.ApiKeyValidationResult result = validate(KEY_ID + ".sk_wrong-secret-0000000");

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Invalid API key secret");
        verify(stats).incrementFailed(KEY_ID, "t");
    }

    @Test
    void shouldRejectDisabledOrExpiredKeyEvenWithRightSecret() {
        when(repository.findById(KEY_ID)).thenReturn(Mono.just(key(false, null)), Mono.just(key(true, Instant.now().minusSeconds(1))));

        assertThat(validate(FULL_KEY).getErrorMessage()).isEqualTo("API key is not active or expired");
        assertThat(validate(FULL_KEY).getErrorMessage()).isEqualTo("API key is not active or expired");
    }

    @Test
    void shouldRejectUnknownKey() {
        when(repository.findById(KEY_ID)).thenReturn(Mono.empty());

        assertThat(validate(FULL_KEY).getErrorMessage()).isEqualTo("API key not found");
    }

    @Test
    void shouldReportRepositoryErrorWithoutDetails() {
        when(repository.findById(KEY_ID)).thenReturn(Mono.error(new IllegalStateException("mongo down: host=10.0.0.3")));

        ApiKeyValidationService.ApiKeyValidationResult result = validate(FULL_KEY);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Internal validation error");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "ak_12345678abc", "ak_12345678abc.sk_short", "xx_12345678abc.sk_0123456789abcdef",
            "ak_123.sk_0123456789abcdef", "ak_12345678abc.sk_0123456789abcdef.sk_0123456789abcdef"})
    void shouldRejectMalformedKeysWithoutTouchingTheDatabase(String fullKey) {
        assertThat(validate(fullKey).isValid()).isFalse();
        verifyNoInteractions(repository);
    }

    @Test
    void shouldDelegateCountersToStats() {
        service.recordSuccessfulRequest(KEY_ID, "t");
        service.recordFailedRequest(KEY_ID, "t");

        verify(stats).incrementSuccessful(KEY_ID, "t");
        verify(stats).incrementFailed(KEY_ID, "t");
    }
}
