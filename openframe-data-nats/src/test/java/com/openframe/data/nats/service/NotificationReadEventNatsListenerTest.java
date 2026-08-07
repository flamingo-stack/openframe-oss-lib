package com.openframe.data.nats.service;

import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.model.NotificationEventType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.service.notification.NotificationReadEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class NotificationReadEventNatsListenerTest {

    private NotificationNatsPublisher publisher;
    private NotificationReadEventNatsListener listener;

    @BeforeEach
    void setUp() {
        publisher = mock(NotificationNatsPublisher.class);
        listener = new NotificationReadEventNatsListener(Optional.of(publisher));
    }

    @Test
    @DisplayName("Given a USER read event, when the listener reacts, then the ids go to the user's subject as one READ message")
    void user_read_event_is_relayed_as_read() {
        listener.onReadStateChanged(new NotificationReadEvent(
                "u1", RecipientType.USER, List.of("n-1", "n-2"), NotificationReadEvent.Transition.READ));

        verify(publisher).publishReadStateToUser("u1", List.of("n-1", "n-2"), NotificationEventType.READ);
    }

    @Test
    @DisplayName("Given a DELETED transition, when the listener reacts, then the event type maps to DELETED — the client removes instead of flipping")
    void deleted_transition_maps_to_deleted() {
        listener.onReadStateChanged(new NotificationReadEvent(
                "u1", RecipientType.USER, List.of("n-1"), NotificationReadEvent.Transition.DELETED));

        verify(publisher).publishReadStateToUser("u1", List.of("n-1"), NotificationEventType.DELETED);
    }

    @Test
    @DisplayName("Given a MACHINE read event, when the listener reacts, then nothing is published — machines have no browser tabs")
    void machine_events_are_ignored() {
        listener.onReadStateChanged(new NotificationReadEvent(
                "m1", RecipientType.MACHINE, List.of("n-1"), NotificationReadEvent.Transition.READ));

        verifyNoInteractions(publisher);
    }

    @Test
    @DisplayName("Given no NATS publisher in this service, when an event arrives, then the listener is a quiet no-op")
    void missing_publisher_is_a_noop() {
        listener = new NotificationReadEventNatsListener(Optional.empty());

        listener.onReadStateChanged(new NotificationReadEvent(
                "u1", RecipientType.USER, List.of("n-1"), NotificationReadEvent.Transition.READ));
    }
}
