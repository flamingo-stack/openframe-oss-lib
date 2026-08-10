package com.openframe.api.service;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    @DisplayName("Given a user with no document, when settings are read, then the master is enabled and every group comes back enabled exactly once — defaults are resolved server-side")
    void absent_document_resolves_to_everything_enabled() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        NotificationSettingsView view = service.get("user-1");

        assertThat(view.enabled()).isTrue();
        assertThat(view.typeSettings()).hasSize(NotificationSettingGroup.values().length);
        assertThat(view.typeSettings()).allMatch(NotificationSettingsView.TypeSetting::enabled);
    }

    @Test
    @DisplayName("Given a legacy document (pushEnabled=false, no enabled field), when read, then the master resolves from the legacy field")
    void legacy_document_feeds_the_master_switch() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(
                NotificationSettings.builder().userId("user-1").pushEnabled(false).build()));

        assertThat(service.get("user-1").enabled()).isFalse();
    }

    @Test
    @DisplayName("Given a stored group override, when read, then that group is disabled and the ones never saved stay enabled")
    void group_override_resolves_and_absent_groups_default_on() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(NotificationSettings.builder()
                .userId("user-1").enabled(true)
                .typeSettings(Map.of(NotificationSettingGroup.MINGO_MESSAGES, false))
                .build()));

        NotificationSettingsView view = service.get("user-1");

        assertThat(view.typeSettings()).contains(
                new NotificationSettingsView.TypeSetting(NotificationSettingGroup.MINGO_MESSAGES, false),
                new NotificationSettingsView.TypeSetting(NotificationSettingGroup.TICKET_ASSIGNED, true));
    }

    @Test
    @DisplayName("update persists the full state and answers the read-back — the response is what the store now holds, not an echo of the input")
    void update_persists_and_reads_back() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(NotificationSettings.builder()
                .userId("user-1").enabled(false).build()));

        NotificationSettingsView view = service.update("user-1", false,
                List.of(new NotificationSettingsView.TypeSetting(NotificationSettingGroup.APPROVAL_MINGO, false)), null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<NotificationSettingGroup, Boolean>> map = ArgumentCaptor.forClass(Map.class);
        verify(repository).saveSettings(eq("user-1"), eq(false), map.capture());
        assertThat(map.getValue()).containsEntry(NotificationSettingGroup.APPROVAL_MINGO, false);
        assertThat(view.enabled()).isFalse();
    }

    @Test
    @DisplayName("Given only the legacy pushEnabled argument, when updating, then it drives the master and the stored group overrides are left alone (null map)")
    void legacy_argument_still_updates_the_master() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        service.update("user-1", null, null, false);

        verify(repository).saveSettings(eq("user-1"), eq(false), isNull());
    }

    @Test
    @DisplayName("Given both enabled and legacy pushEnabled, when updating, then enabled wins")
    void enabled_wins_over_the_legacy_argument() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        service.update("user-1", true, null, false);

        verify(repository).saveSettings(eq("user-1"), eq(true), isNull());
    }

    @Test
    @DisplayName("Given neither enabled nor pushEnabled, when updating, then BadRequestException — a write without a master value has no meaning")
    void missing_master_is_rejected() {
        assertThatThrownBy(() -> service.update("user-1", null, null, null))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).saveSettings(anyString(), anyBoolean(), any());
    }
}
