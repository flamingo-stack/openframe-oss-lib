package com.openframe.data.nats.service;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.channel.NotificationChannel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationChannelDispatcherTest {

    @Test
    @DisplayName("dispatch delivers to every user on every registered channel")
    void delivers_to_every_user_on_every_channel() {
        NotificationChannel fcm = channel("fcm");
        NotificationChannel slack = channel("slack");
        NotificationChannelDispatcher dispatcher = new NotificationChannelDispatcher(List.of(fcm, slack));

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
        NotificationChannelDispatcher dispatcher = new NotificationChannelDispatcher(List.of(fcm));

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1", "u2"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();

        verify(fcm).deliver(eq("u2"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given no channel is registered (push module absent), when dispatch runs, then it is a no-op")
    void no_channels_is_a_noop() {
        NotificationChannelDispatcher dispatcher = new NotificationChannelDispatcher(List.of());

        assertThatCode(() -> dispatcher.dispatch(Set.of("u1"), notification(), NotificationCategory.MINGO))
                .doesNotThrowAnyException();
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
