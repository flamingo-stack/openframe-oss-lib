package com.openframe.api.service;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSetting;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;

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

        assertThat(view.isEnabled()).isTrue();
        assertThat(view.getTypeSettings()).hasSize(NotificationSettingGroup.values().length);
        assertThat(view.getTypeSettings()).allMatch(NotificationTypeSetting::isEnabled);
    }

    @Test
    @DisplayName("Given a stored group override, when read, then that group is disabled and the ones never saved stay enabled")
    void group_override_resolves_and_absent_groups_default_on() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(NotificationSettings.builder()
                .userId("user-1").enabled(true)
                .mutedGroups(Set.of(NotificationSettingGroup.MINGO_MESSAGES))
                .build()));

        NotificationSettingsView view = service.get("user-1");

        assertThat(view.getTypeSettings()).contains(
                new NotificationTypeSetting(NotificationSettingGroup.MINGO_MESSAGES, false),
                new NotificationTypeSetting(NotificationSettingGroup.TICKET_ASSIGNED, true));
    }

    @Test
    @DisplayName("update stores only the disabled entries as the muted set and answers the read-back — the response is what the store now holds, not an echo of the input")
    void update_persists_muted_set_and_reads_back() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.of(NotificationSettings.builder()
                .userId("user-1").enabled(false).build()));

        NotificationSettingsView view = service.update("user-1", false, List.of(
                new NotificationTypeSetting(NotificationSettingGroup.APPROVAL_MINGO, false),
                new NotificationTypeSetting(NotificationSettingGroup.TICKET_ASSIGNED, true)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Set<NotificationSettingGroup>> muted = ArgumentCaptor.forClass(Set.class);
        verify(repository).saveSettings(eq("user-1"), eq(false), muted.capture());
        assertThat(muted.getValue()).containsExactly(NotificationSettingGroup.APPROVAL_MINGO);
        assertThat(view.isEnabled()).isFalse();
    }

    @Test
    @DisplayName("An all-enabled list writes an empty muted set — clearing every mute, not skipping the write")
    void all_enabled_list_clears_the_muted_set() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        service.update("user-1", true,
                List.of(new NotificationTypeSetting(NotificationSettingGroup.MINGO_MESSAGES, true)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Set<NotificationSettingGroup>> muted = ArgumentCaptor.forClass(Set.class);
        verify(repository).saveSettings(eq("user-1"), eq(true), muted.capture());
        assertThat(muted.getValue()).isEmpty();
    }

    @Test
    @DisplayName("Given a master-only write (null typeSettings), when updating, then the stored muted set is left alone")
    void master_only_write_keeps_stored_muted_set() {
        when(repository.findByUserId("user-1")).thenReturn(Optional.empty());

        service.update("user-1", false, null);

        verify(repository).saveSettings(eq("user-1"), eq(false), isNull());
    }

    @Test
    @DisplayName("Given a typeSettings entry without a group, when updating, then BadRequestException — an override must name its checkbox")
    void groupless_override_is_rejected() {
        List<NotificationTypeSetting> broken =
                List.of(new NotificationTypeSetting(null, false));

        assertThatThrownBy(() -> service.update("user-1", true, broken))
                .isInstanceOf(BadRequestException.class);
        verify(repository, never()).saveSettings(anyString(), anyBoolean(), any());
    }
}
