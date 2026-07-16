package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationSettings;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationSettingsRepositoryTest {

    @Test
    @DisplayName("Given an empty audience, when disabled users are looked up, then no query is issued at all")
    void empty_audience_issues_no_query() {
        NotificationSettingsRepository repository = mock(NotificationSettingsRepository.class);
        when(repository.findPushDisabledUserIds(anyCollection())).thenCallRealMethod();

        assertThat(repository.findPushDisabledUserIds(List.of())).isEmpty();

        verify(repository, never()).findByUserIdInAndPushEnabledFalse(anyCollection());
    }

    @Test
    @DisplayName("Given some users disabled push, when the audience is checked, then only their userIds come back — a user without a settings document is enabled by default")
    void only_explicitly_disabled_users_are_returned() {
        NotificationSettingsRepository repository = mock(NotificationSettingsRepository.class);
        when(repository.findPushDisabledUserIds(anyCollection())).thenCallRealMethod();
        when(repository.findByUserIdInAndPushEnabledFalse(anyCollection())).thenReturn(
                List.of(NotificationSettings.builder().userId("u1").pushEnabled(false).build()));

        Set<String> disabled = repository.findPushDisabledUserIds(List.of("u1", "u2"));

        assertThat(disabled).containsExactly("u1");
    }
}
