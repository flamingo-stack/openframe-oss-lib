package com.openframe.management.service;

import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiKeyExpirationServiceTest {

    @Mock
    private ApiKeyRepository apiKeyRepository;

    private ApiKeyExpirationService service;

    @BeforeEach
    void setUp() {
        service = new ApiKeyExpirationService(apiKeyRepository);
    }

    // -----------------------------------------------------------------------
    // Proving the problem existed: expired key stays enabled=true without a sweep
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("ApiKey model — expiration semantics (proving the original bug)")
    class ExpirationSemantics {

        @Test
        @DisplayName("isExpired() returns true when expiresAt is in the past")
        void isExpiredWhenPast() {
            ApiKey key = expiredKey();
            assertThat(key.isExpired()).isTrue();
        }

        @Test
        @DisplayName("isActive() returns false for an expired key — gateway correctly rejects at request time")
        void isNotActiveWhenExpired() {
            ApiKey key = expiredKey();
            assertThat(key.isActive()).isFalse();
        }

        @Test
        @DisplayName("enabled flag stays true without a sweep — proves the bug: stale data in DB")
        void enabledFlagStaysTrueWithoutSweep() {
            ApiKey key = expiredKey();
            // isActive() is false but enabled is still true — consumers reading `enabled`
            // directly (e.g. audit queries) would see the key as enabled
            assertThat(key.isExpired()).isTrue();
            assertThat(key.isEnabled()).isTrue();
        }

        @Test
        @DisplayName("isExpired() returns false when expiresAt is in the future")
        void isNotExpiredWhenFuture() {
            ApiKey key = validKey();
            assertThat(key.isExpired()).isFalse();
        }

        @Test
        @DisplayName("isActive() returns true for an enabled, non-expired key")
        void isActiveWhenValid() {
            ApiKey key = validKey();
            assertThat(key.isActive()).isTrue();
        }

        @Test
        @DisplayName("isExpired() returns false when expiresAt is null — no expiry set")
        void isNotExpiredWhenNoExpirySet() {
            ApiKey key = keyWithNoExpiry();
            assertThat(key.isExpired()).isFalse();
            assertThat(key.isActive()).isTrue();
        }
    }

    // -----------------------------------------------------------------------
    // Proving the fix works
    // -----------------------------------------------------------------------

    @Nested
    @DisplayName("disableExpiredKeys — fix verification")
    class DisableExpiredKeys {

        @Test
        @DisplayName("sets enabled=false and saves each expired key")
        void disablesExpiredKeys() {
            ApiKey key1 = expiredKey("key-1");
            ApiKey key2 = expiredKey("key-2");
            when(apiKeyRepository.findExpiredKeys(any())).thenReturn(List.of(key1, key2));
            when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.disableExpiredKeys();

            ArgumentCaptor<ApiKey> captor = ArgumentCaptor.forClass(ApiKey.class);
            verify(apiKeyRepository, times(2)).save(captor.capture());

            assertThat(captor.getAllValues()).allSatisfy(saved -> {
                assertThat(saved.isEnabled()).isFalse();
                assertThat(saved.getUpdatedAt()).isNotNull();
            });
        }

        @Test
        @DisplayName("returns the count of disabled keys")
        void returnsCountOfDisabledKeys() {
            when(apiKeyRepository.findExpiredKeys(any()))
                    .thenReturn(List.of(expiredKey("k1"), expiredKey("k2"), expiredKey("k3")));
            when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            int count = service.disableExpiredKeys();

            assertThat(count).isEqualTo(3);
        }

        @Test
        @DisplayName("does nothing and returns 0 when no expired keys exist")
        void doesNothingWhenNoExpiredKeys() {
            when(apiKeyRepository.findExpiredKeys(any())).thenReturn(List.of());

            int count = service.disableExpiredKeys();

            assertThat(count).isZero();
            verify(apiKeyRepository, never()).save(any());
        }

        @Test
        @DisplayName("already-disabled keys are not returned by findExpiredKeys — no double-save")
        void alreadyDisabledKeysAreNotReprocessed() {
            // findExpiredKeys query filters: { expiresAt: {$lt: now}, enabled: true }
            // so disabled keys are already excluded at the DB level
            when(apiKeyRepository.findExpiredKeys(any())).thenReturn(List.of());

            service.disableExpiredKeys();

            verify(apiKeyRepository, never()).save(any());
        }

        @Test
        @DisplayName("after sweep, key is both isExpired()=true and enabled=false")
        void afterSweepKeyIsFullyDeactivated() {
            ApiKey key = expiredKey("key-sweep");
            when(apiKeyRepository.findExpiredKeys(any())).thenReturn(List.of(key));
            when(apiKeyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.disableExpiredKeys();

            assertThat(key.isExpired()).isTrue();
            assertThat(key.isEnabled()).isFalse();
            assertThat(key.isActive()).isFalse();
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private ApiKey expiredKey() {
        return expiredKey("key-expired");
    }

    private ApiKey expiredKey(String keyId) {
        ApiKey key = new ApiKey();
        key.setKeyId(keyId);
        key.setEnabled(true);
        key.setExpiresAt(Instant.now().minus(1, ChronoUnit.HOURS));
        return key;
    }

    private ApiKey validKey() {
        ApiKey key = new ApiKey();
        key.setKeyId("key-valid");
        key.setEnabled(true);
        key.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        return key;
    }

    private ApiKey keyWithNoExpiry() {
        ApiKey key = new ApiKey();
        key.setKeyId("key-no-expiry");
        key.setEnabled(true);
        key.setExpiresAt(null);
        return key;
    }
}
