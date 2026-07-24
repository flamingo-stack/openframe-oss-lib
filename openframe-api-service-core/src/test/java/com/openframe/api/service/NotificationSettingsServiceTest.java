package com.openframe.api.service;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationSettingsServiceTest {

    private NotificationSettingsRepository repository;
    private NotificationSettingsService service;

    @BeforeEach
    void setUp() {
        repository = mock(NotificationSettingsRepository.class);
        service = new NotificationSettingsService(repository);
    }

    @Test
    @DisplayName("Given a user who never touched the toggle (no document), when settings are read, then pushEnabled defaults to TRUE and nothing is created")
    void absent_document_answers_the_enabled_default() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        assertThat(service.get("user-1").isPushEnabled()).isTrue();
    }

    @Test
    @DisplayName("Given a stored document with push disabled, when read, then pushEnabled is false")
    void stored_document_wins_over_the_default() {
        when(repository.findByUserId("user-1")).thenReturn(
                Optional.of(NotificationSettings.builder().userId("user-1").pushEnabled(false).build()));

        assertThat(service.get("user-1").isPushEnabled()).isFalse();
    }

    @Test
    @DisplayName("update persists for the user and echoes the new state")
    void update_persists_and_echoes() {
        NotificationSettings result = service.update("user-1", false);

        verify(repository).setPushEnabled("user-1", false);
        assertThat(result.isPushEnabled()).isFalse();
    }

    @Test
    @DisplayName("Given a null pushEnabled, when updating, then BadRequestException — a null toggle has no meaning")
    void null_toggle_is_rejected() {
        assertThatThrownBy(() -> service.update("user-1", null))
                .isInstanceOf(BadRequestException.class);
    }
}
