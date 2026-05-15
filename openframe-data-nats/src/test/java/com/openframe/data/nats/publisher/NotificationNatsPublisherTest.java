package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.nats.model.NotificationMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class NotificationNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private NotificationNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        publisher = new NotificationNatsPublisher(messagePublisher);
    }

    @Test
    @DisplayName("Given a persisted notification and a userId, when publishToUser is called, then the message is routed to user.<userId>.notification with id and title preserved")
    void publish_to_user_routes_to_user_subject() {
        Notification notification = persistedNotification();

        publisher.publishToUser("user-42", notification);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publishPersistent(subject.capture(), message.capture());
        assertThat(subject.getValue()).isEqualTo("user.user-42.notification");
        assertThat(message.getValue().getId()).isEqualTo(notification.getId());
        assertThat(message.getValue().getTitle()).isEqualTo(notification.getTitle());
    }

    @Test
    @DisplayName("Given a persisted notification and a machineId, when publishToMachine is called, then the message is routed to machine.<machineId>.notification")
    void publish_to_machine_routes_to_machine_subject() {
        Notification notification = persistedNotification();

        publisher.publishToMachine("machine-7", notification);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(messagePublisher).publishPersistent(subject.capture(), any());
        assertThat(subject.getValue()).isEqualTo("machine.machine-7.notification");
    }

    @Test
    @DisplayName("Given the broker raises NatsException, when publishToUser is called, then the failure is swallowed and no exception propagates — Mongo is source of truth")
    void broker_failure_swallowed() {
        Notification notification = persistedNotification();
        doThrow(new NatsException("broker offline")).when(messagePublisher).publishPersistent(anyString(), any());

        publisher.publishToUser("user-1", notification);
        // No exception escapes; nothing to assert on return — publish*() returns void now.
    }

    @Test
    @DisplayName("Given a notification without an id, when publishToUser is called, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void unpersisted_notification_throws_before_broker() {
        Notification unpersisted = Notification.builder()
                .title("Test")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").build())
                .build();

        assertThatThrownBy(() -> publisher.publishToUser("user-1", unpersisted))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(messagePublisher);
    }

    private static Notification persistedNotification() {
        return Notification.builder()
                .id("notif-" + System.nanoTime())
                .title("Hello")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").build())
                .build();
    }
}
