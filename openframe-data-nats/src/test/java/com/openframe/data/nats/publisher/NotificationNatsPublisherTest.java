package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.BroadcastRecipient;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.MachineRecipient;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.UserRecipient;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class NotificationNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private NotificationNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        publisher = new NotificationNatsPublisher(messagePublisher);
    }

    @Test
    @DisplayName("Given a notification with a USER recipient, when publishing, then the message is routed to the per-user subject with id and title preserved")
    void publish_userRecipient_routesToUserSubject() {
        Notification notification = persistedNotification(new UserRecipient("user-42"));

        publisher.publish(notification);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publishPersistent(subject.capture(), message.capture());
        assertThat(subject.getValue()).isEqualTo("user.user-42.notification");
        assertThat(message.getValue().getId()).isEqualTo(notification.getId());
        assertThat(message.getValue().getTitle()).isEqualTo(notification.getTitle());
    }

    @Test
    @DisplayName("Given a notification with a MACHINE recipient, when publishing, then the message is routed to the per-machine subject")
    void publish_machineRecipient_routesToMachineSubject() {
        Notification notification = persistedNotification(new MachineRecipient("machine-7"));

        publisher.publish(notification);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(messagePublisher).publishPersistent(subject.capture(), any());
        assertThat(subject.getValue()).isEqualTo("machine.machine-7.notification");
    }

    @Test
    @DisplayName("Given a notification with a BROADCAST recipient, when publishing, then the message is routed to the tenant-wide broadcast subject")
    void publish_broadcastRecipient_routesToBroadcastSubject() {
        Notification notification = persistedNotification(new BroadcastRecipient());

        publisher.publish(notification);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(messagePublisher).publishPersistent(subject.capture(), any());
        assertThat(subject.getValue()).isEqualTo("notification.broadcast");
    }

    @Test
    @DisplayName("Given the broker raises a failure, when publishing, then the exception is swallowed and the notification is returned unchanged — Mongo is source of truth")
    void publish_jetStreamFailure_isSwallowedAndNotificationReturned() {
        Notification notification = persistedNotification(new UserRecipient("user-1"));
        doThrow(new NatsException("broker offline")).when(messagePublisher).publishPersistent(anyString(), any());

        Notification result = publisher.publish(notification);

        assertThat(result).isSameAs(notification);
    }

    @Test
    @DisplayName("Given a notification without an id, when publishing, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void publish_unpersistedNotification_throwsBeforeHittingBroker() {
        Notification unpersisted = Notification.builder()
                .recipient(new UserRecipient("user-1"))
                .title("Test")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").build())
                .build();

        assertThatThrownBy(() -> publisher.publish(unpersisted))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(messagePublisher);
    }

    private static Notification persistedNotification(com.openframe.data.document.notification.Recipient recipient) {
        return Notification.builder()
                .id("notif-" + System.nanoTime())
                .recipient(recipient)
                .title("Hello")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").build())
                .build();
    }
}
