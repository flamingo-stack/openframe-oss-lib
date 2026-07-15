package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.channel.NotificationChannel;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationChannelDispatcherTest {

    private NotificationReadStateService readStateService;

    @BeforeEach
    void setUp() {
        readStateService = mock(NotificationReadStateService.class);
    }

    @Test
    @DisplayName("dispatch delivers to every user on every registered channel")
    void delivers_to_every_user_on_every_channel() {
        NotificationChannel fcm = channel("fcm");
        NotificationChannel slack = channel("slack");
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm, slack), Optional.empty(), 0);

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
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.empty(), 0);

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given no channel is registered (push module absent), when dispatch runs, then it is a no-op and the settings collection is never queried")
    void no_channels_is_a_noop_and_skips_the_settings_lookup() {
        NotificationSettingsRepository settings = mock(NotificationSettingsRepository.class);
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(), Optional.of(settings), 0);

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
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.of(settings), 0);

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
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.of(settings), 0);

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given the grace window is disabled (0), when dispatch runs, then the read-state collection is never queried — the kill switch keeps the stopgap fully inert")
    void grace_disabled_never_touches_read_state() {
        NotificationChannel fcm = channel("fcm");
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.empty(), 0);

        dispatcher.dispatch(Set.of("u1"), notification(), NotificationCategory.MINGO);

        verifyNoInteractions(readStateService);
        verify(fcm).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given a grace window and one recipient read the notification on the web within it, when dispatch runs, then the reader is spared the push and the still-unread recipient gets it — machine rows are ignored")
    void grace_window_skips_recipients_who_already_read() {
        NotificationChannel fcm = channel("fcm");
        when(readStateService.findRecipients(anyString())).thenReturn(List.of(
                readState("u1", RecipientType.USER, ReadStatus.READ),
                readState("u2", RecipientType.USER, ReadStatus.UNREAD),
                readState("m1", RecipientType.MACHINE, ReadStatus.UNREAD)));
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.empty(), 1);

        dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO);

        verify(fcm, never()).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm, never()).deliver(eq("m1"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given the read-state lookup throws after the grace window, when dispatch runs, then everyone is delivered — fail open, a broken lookup must not silently eat pushes")
    void grace_window_lookup_failure_defaults_to_delivering_to_everyone() {
        NotificationChannel fcm = channel("fcm");
        when(readStateService.findRecipients(anyString())).thenThrow(new RuntimeException("mongo down"));
        NotificationChannelDispatcher dispatcher = dispatcher(List.of(fcm), Optional.empty(), 1);

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u1"), any(Notification.class), any(NotificationCategory.class));
        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    private NotificationChannelDispatcher dispatcher(List<NotificationChannel> channels,
                                                     Optional<NotificationSettingsRepository> settings,
                                                     long graceSeconds) {
        NotificationChannelDispatcher dispatcher =
                new NotificationChannelDispatcher(channels, settings, readStateService);
        ReflectionTestUtils.setField(dispatcher, "webGraceSeconds", graceSeconds);
        return dispatcher;
    }

    private static NotificationChannel channel(String name) {
        NotificationChannel channel = mock(NotificationChannel.class);
        when(channel.name()).thenReturn(name);
        return channel;
    }

    private static Notification notification() {
        Notification notification = Notification.builder().build();
        notification.setId("notif-1");
        return notification;
    }

    private static NotificationReadState readState(String recipientId, RecipientType type, ReadStatus status) {
        NotificationReadState readState = new NotificationReadState();
        readState.setRecipientId(recipientId);
        readState.setRecipientType(type);
        readState.setStatus(status);
        return readState;
    }
}
