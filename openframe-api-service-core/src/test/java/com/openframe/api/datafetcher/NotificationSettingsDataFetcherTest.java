package com.openframe.api.datafetcher;

import com.openframe.api.service.NotificationSettingsService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationSettingsDataFetcherTest {

    private NotificationSettingsService service;
    private NotificationSettingsDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        service = mock(NotificationSettingsService.class);
        fetcher = new NotificationSettingsDataFetcher(service);
    }

    @Test
    @DisplayName("notificationSettings delegates to the service for the authenticated user")
    void query_delegates_with_the_principal_id() {
        NotificationSettings settings = NotificationSettings.builder().pushEnabled(true).build();
        when(service.get("user-1")).thenReturn(settings);

        assertThat(fetcher.notificationSettings(principal("user-1"))).isSameAs(settings);
        verify(service).get("user-1");
    }

    @Test
    @DisplayName("updateNotificationSettings delegates the toggle for the authenticated user")
    void update_delegates_with_the_principal_id() {
        NotificationSettings updated = NotificationSettings.builder().pushEnabled(false).build();
        when(service.update("user-1", false)).thenReturn(updated);

        assertThat(fetcher.updateNotificationSettings(false, principal("user-1")).isPushEnabled()).isFalse();
        verify(service).update("user-1", false);
    }

    @Test
    @DisplayName("Given an AGENT principal, when it reads or writes settings, then it is rejected before the service — settings belong to a person, not a machine")
    void agent_principal_is_rejected() {
        AuthPrincipal agent = AuthPrincipal.builder().id("machine-7").actorType(ActorType.AGENT).build();

        assertThatThrownBy(() -> fetcher.notificationSettings(agent)).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> fetcher.updateNotificationSettings(false, agent)).isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(service);
    }

    private static AuthPrincipal principal(String userId) {
        return AuthPrincipal.builder().id(userId).actorType(ActorType.ADMIN).build();
    }
}
