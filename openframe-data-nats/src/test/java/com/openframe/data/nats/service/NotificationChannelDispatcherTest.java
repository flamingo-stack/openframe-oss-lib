package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationChannelDispatcherTest {

    @Test
    @DisplayName("dispatch delivers to every user on every registered channel")
    void delivers_to_every_user_on_every_channel() {
        NotificationChannel fcm = channel("fcm");
        NotificationChannel slack = channel("slack");
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(List.of(fcm, slack), Optional.empty());

        dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO);

        verify(fcm).deliver(eq("u1"), any(Notification.class), eq(NotificationCategory.MINGO));
        verify(fcm).deliver(eq("u2"), any(Notification.class), eq(NotificationCategory.MINGO));
        verify(slack).deliver(eq("u1"), any(Notification.class), eq(NotificationCategory.MINGO));
        verify(slack).deliver(eq("u2"), any(Notification.class), eq(NotificationCategory.MINGO));
    }

    @Test
    @DisplayName("Given a channel throws for one user, when dispatch runs, then the exception is swallowed and the other users are still delivered — a channel is best-effort and must never fail the notification")
    void a_throwing_channel_is_swallowed_and_others_still_deliver() {
        NotificationChannel fcm = channel("fcm");
        doThrow(new RuntimeException("firebase down")).when(fcm)
                .deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(List.of(fcm), Optional.empty());

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given no channel is registered (push module absent), when dispatch runs, then it is a no-op and the settings collection is never queried")
    void no_channels_is_a_noop_and_skips_the_settings_lookup() {
        NotificationSettingsRepository settings = mock(NotificationSettingsRepository.class);
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(List.of(), Optional.of(settings));

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verifyNoInteractions(settings);
    }

    @Test
    @DisplayName("Given a user disabled push in settings, when dispatch runs, then that user is skipped on every channel and the others still receive — the mute is enforced server-side, not by the client hiding banners")
    void muted_user_is_skipped_and_others_still_deliver() {
        NotificationChannel fcm = channel("fcm");
        NotificationSettingsRepository settings = mock(NotificationSettingsRepository.class);
        when(settings.findPushDisabledUserIds(anyCollection())).thenReturn(Set.of("u1"));
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(List.of(fcm), Optional.of(settings));

        dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO);

        verify(fcm, never()).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given the settings lookup throws, when dispatch runs, then everyone is delivered — absence of a settings doc means enabled, so a failed lookup defaults to enabled too")
    void settings_lookup_failure_defaults_to_delivering_to_everyone() {
        NotificationChannel fcm = channel("fcm");
        NotificationSettingsRepository settings = mock(NotificationSettingsRepository.class);
        when(settings.findPushDisabledUserIds(anyCollection())).thenThrow(new RuntimeException("mongo down"));
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(List.of(fcm), Optional.of(settings));

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    private static NotificationChannel channel(String name) {
        NotificationChannel channel = mock(NotificationChannel.class);
        when(channel.name()).thenReturn(name);
        return channel;
    }

    private static Notification notification() {
        return Notification.builder().build();
    }
}
