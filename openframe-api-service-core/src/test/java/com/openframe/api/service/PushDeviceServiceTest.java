package com.openframe.api.service;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.data.repository.push.PushDeviceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PushDeviceServiceTest {

    private PushDeviceRepository repository;
    private PushDeviceService service;

    @BeforeEach
    void setUp() {
        repository = mock(PushDeviceRepository.class);
        service = new PushDeviceService(repository);
    }

    @Test
    @DisplayName("register upserts the token for the given user and returns whether a new row was created")
    void register_delegates_and_returns_created() {
        when(repository.registerToken("user-1", "tok-1", PushPlatform.ANDROID)).thenReturn(true);

        assertThat(service.register("user-1", "tok-1", PushPlatform.ANDROID)).isTrue();
    }

    @Test
    @DisplayName("Given a blank token, when registering, then BadRequestException — an empty token row would never receive anything and pollute every multicast")
    void register_rejects_a_blank_token() {
        assertThatThrownBy(() -> service.register("user-1", " ", PushPlatform.IOS))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("Given a null platform, when registering, then BadRequestException")
    void register_rejects_a_null_platform() {
        assertThatThrownBy(() -> service.register("user-1", "tok-1", null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    @DisplayName("unregister deletes only the caller's own token and returns true when a row was removed")
    void unregister_scopes_to_the_caller() {
        when(repository.deleteByUserIdAndToken("user-1", "mine")).thenReturn(1L);

        assertThat(service.unregister("user-1", "mine")).isTrue();
    }

    @Test
    @DisplayName("unregister returns false for an unknown (but valid) token — a token that was never registered is an idempotent no-op, not an error")
    void unregister_is_quiet_about_unknown_tokens() {
        when(repository.deleteByUserIdAndToken("user-1", "ghost")).thenReturn(0L);

        assertThat(service.unregister("user-1", "ghost")).isFalse();
    }

    @Test
    @DisplayName("Given a blank token, when unregistering, then BadRequestException — a blank token is a malformed request, not a real logout")
    void unregister_rejects_a_blank_token() {
        assertThatThrownBy(() -> service.unregister("user-1", " "))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }
}
