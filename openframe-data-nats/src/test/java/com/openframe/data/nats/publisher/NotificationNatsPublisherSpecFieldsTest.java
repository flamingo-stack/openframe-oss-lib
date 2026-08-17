package com.openframe.data.nats.publisher;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.nats.model.NotificationMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

// Separate from NotificationNatsPublisherTest: that file is concurrently edited by the in-flight content PR.
class NotificationNatsPublisherSpecFieldsTest {

    @Test
    @DisplayName("Given a stored notification with spec fields, when published, then type and attributes ride the live payload next to the context")
    void spec_fields_ride_the_live_payload() {
        NatsMessagePublisher messagePublisher = mock(NatsMessagePublisher.class);
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(messagePublisher);
        Notification stored = Notification.builder()
                .id("notif-1")
                .title("Ticket #1 assigned")
                .type("TICKET_ASSIGNED")
                .attributes(Map.of("ticketId", "t-1"))
                .context(GenericContext.builder().type("TICKET_ASSIGNED").payload("{}").build())
                .build();

        publisher.publishToUser("user-1", stored, NotificationCategory.TICKETS);

        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(anyString(), message.capture());
        assertThat(message.getValue().getType()).isEqualTo("TICKET_ASSIGNED");
        assertThat(message.getValue().getAttributes()).containsEntry("ticketId", "t-1");
        assertThat(message.getValue().getContext()).isNotNull();
    }

    @Test
    @DisplayName("A legacy notification without spec fields publishes with them null — additive, old shape untouched")
    void legacy_notification_publishes_null_spec_fields() {
        NatsMessagePublisher messagePublisher = mock(NatsMessagePublisher.class);
        NotificationNatsPublisher publisher = new NotificationNatsPublisher(messagePublisher);
        Notification stored = Notification.builder()
                .id("notif-2")
                .title("Old style")
                .context(GenericContext.builder().type("welcome").payload("{}").build())
                .build();

        publisher.publishToUser("user-1", stored, NotificationCategory.GENERIC);

        ArgumentCaptor<NotificationMessage> message = ArgumentCaptor.forClass(NotificationMessage.class);
        verify(messagePublisher).publish(anyString(), message.capture());
        assertThat(message.getValue().getType()).isNull();
        assertThat(message.getValue().getAttributes()).isNull();
    }
}
