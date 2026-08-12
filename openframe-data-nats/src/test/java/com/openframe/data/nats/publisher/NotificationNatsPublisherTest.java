package com.openframe.data.nats.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.nats.model.NotificationEventType;
import com.openframe.data.nats.model.NotificationMessage;
import com.openframe.data.service.notification.NotificationContentRedactor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class NotificationNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private NotificationContentRedactor contentRedactor;
    private NotificationNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        contentRedactor = mock(NotificationContentRedactor.class);
        // Default: nothing suppressed — the payload carries the stored description through.
        when(contentRedactor.descriptionFor(any(), any(), anyBoolean())).thenAnswer(invocation -> {
            Notification argument = invocation.getArgument(0);
            return argument == null ? null : argument.getDescription();
        });
        publisher = new NotificationNatsPublisher(messagePublisher, contentRedactor);
    }

    @Test
    @DisplayName("Given the tenant suppresses content, when publishing, then the live payload carries the neutral description, not the stored one")
    void publish_applies_content_suppression() {
        Notification notification = persistedNotification();
        when(contentRedactor.descriptionFor(notification, NotificationCategory.TICKETS, true))
                .thenReturn("New activity on this ticket");

        // The flag is resolved once by the broadcaster and handed down — the publisher does not look it up.
        publisher.publishToUser("user-42", notification, NotificationCategory.TICKETS, true);

        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(anyString(), message.capture());
        assertThat(message.getValue().getDescription()).isEqualTo("New activity on this ticket");
        assertThat(message.getValue().getTitle()).isEqualTo(notification.getTitle());
    }

    @Test
    @DisplayName("Given a persisted notification and a userId, when publishToUser is called, then the message is routed to user.<userId>.notification with id and title preserved")
    void publish_to_user_routes_to_user_subject() {
        Notification notification = persistedNotification();

        publisher.publishToUser("user-42", notification, NotificationCategory.TICKETS, false);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(subject.capture(), message.capture());
        assertThat(subject.getValue()).isEqualTo("user.user-42.notification");
        assertThat(message.getValue().getId()).isEqualTo(notification.getId());
        assertThat(message.getValue().getTitle()).isEqualTo(notification.getTitle());
        assertThat(message.getValue().getCategory()).isEqualTo(NotificationCategory.TICKETS);
    }

    @Test
    @DisplayName("Given a persisted notification and a machineId, when publishToMachine is called, then the message is routed to machine.<machineId>.notification")
    void publish_to_machine_routes_to_machine_subject() {
        Notification notification = persistedNotification();

        publisher.publishToMachine("machine-7", notification, NotificationCategory.DEVICES, false);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(messagePublisher).publish(subject.capture(), any());
        assertThat(subject.getValue()).isEqualTo("machine.machine-7.notification");
    }

    @Test
    @DisplayName("Given the broker raises NatsException, when publishToUser is called, then the failure is swallowed and no exception propagates — Mongo is source of truth")
    void broker_failure_swallowed() {
        Notification notification = persistedNotification();
        doThrow(new NatsException("broker offline")).when(messagePublisher).publish(anyString(), any());

        publisher.publishToUser("user-1", notification, NotificationCategory.GENERIC, false);
        // No exception escapes; nothing to assert on return — publish*() returns void now.
    }

    @Test
    @DisplayName("Given a blank userId, when publishToUser is called, then IllegalArgumentException is raised before any broker call — blank ids would produce malformed subject `user..notification`")
    void blank_user_id_rejected() {
        Notification notification = persistedNotification();
        assertThatThrownBy(() -> publisher.publishToUser("   ", notification, NotificationCategory.GENERIC, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("userId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("Given a blank machineId, when publishToMachine is called, then IllegalArgumentException is raised before any broker call — same invariant as publishToUser")
    void blank_machine_id_rejected() {
        Notification notification = persistedNotification();
        assertThatThrownBy(() -> publisher.publishToMachine("", notification, NotificationCategory.GENERIC, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("machineId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("Given a notification without an id, when publishToUser is called, then IllegalArgumentException is raised before any broker call — caller must save() first")
    void unpersisted_notification_throws_before_broker() {
        Notification unpersisted = Notification.builder()
                .title("Test")
                .createdAt(Instant.now())
                .context(GenericContext.builder().type("welcome").build())
                .build();

        assertThatThrownBy(() -> publisher.publishToUser("user-1", unpersisted, NotificationCategory.GENERIC, false))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("Given read-state ids, when publishReadStateToUser is called, then a content-free message with eventType and ids goes to the user subject")
    void read_state_publish_carries_only_ids_and_event_type() {
        publisher.publishReadStateToUser("user-42", java.util.List.of("n-1", "n-2"), com.openframe.data.nats.model.NotificationEventType.READ);

        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(eq("user.user-42.notification"), message.capture());
        assertThat(message.getValue().getEventType()).isEqualTo(com.openframe.data.nats.model.NotificationEventType.READ);
        assertThat(message.getValue().getNotificationIds()).containsExactly("n-1", "n-2");
        assertThat(message.getValue().getId()).isNull();
        assertThat(message.getValue().getTitle()).isNull();
    }

    @Test
    @DisplayName("Given NATS is down, when publishReadStateToUser fails, then the exception is swallowed — read-state sync is best-effort")
    void read_state_publish_swallows_nats_failures() {
        doThrow(new NatsException("down")).when(messagePublisher).publish(anyString(), any());

        publisher.publishReadStateToUser("user-42", java.util.List.of("n-1"), com.openframe.data.nats.model.NotificationEventType.DELETED);
    }

    @Test
    @DisplayName("Given a blank userId, when publishReadStateToUser is called, then it throws — a broadcast to a malformed subject must not happen")
    void read_state_publish_rejects_blank_user() {
        assertThatThrownBy(() -> publisher.publishReadStateToUser(" ", java.util.List.of("n-1"), com.openframe.data.nats.model.NotificationEventType.READ))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Given a stored notification, when it is published, then the live payload carries every displayed field verbatim — a live popup must match what a later query returns")
    void live_payload_matches_the_stored_record_field_for_field() {
        Notification stored = Notification.builder()
                .id("notif-parity")
                .severity(NotificationSeverity.WARNING)
                .title("Ticket #1234 — Printer offline at front desk")
                .description("Escalated by the user - waiting for a technician")
                .createdAt(Instant.parse("2026-08-11T09:15:30Z"))
                .context(GenericContext.builder().type("TICKET_ESCALATED_BY_USER").payload("{}").build())
                .build();

        publisher.publishToUser("user-42", stored, NotificationCategory.TICKETS, false);

        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(anyString(), message.capture());
        NotificationMessage published = message.getValue();
        assertThat(published.getId()).isEqualTo(stored.getId());
        assertThat(published.getTitle()).isEqualTo(stored.getTitle());
        assertThat(published.getDescription()).isEqualTo(stored.getDescription());
        assertThat(published.getCreatedAt()).isEqualTo(stored.getCreatedAt());
        assertThat(published.getSeverity()).isEqualTo(stored.getSeverity());
        assertThat(published.getContext()).isSameAs(stored.getContext());
        assertThat(published.getCategory()).isEqualTo(NotificationCategory.TICKETS);
        assertThat(published.getEventType()).isEqualTo(NotificationEventType.CREATED);
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
