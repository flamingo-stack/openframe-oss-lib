package com.openframe.notification.readstate;

import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.NotificationReadStateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationReadStateServiceTest {

    private static final String ALICE = "user-alice";
    private static final RecipientType U = RecipientType.USER;

    private NotificationReadStateRepository repository;
    private RecordingListener listener;
    private NotificationReadStateService service;

    @BeforeEach
    void setUp() {
        repository = mock(NotificationReadStateRepository.class);
        listener = new RecordingListener();
        service = service(List.of(listener));
    }

    private NotificationReadStateService service(List<NotificationReadEventListener> listeners) {
        return new NotificationReadStateService(repository, mock(TenantIdProvider.class), listeners);
    }

    @Test
    @DisplayName("Given an UNREAD row, when markRead flips it, then every listener gets ONE event carrying the id and the READ transition")
    void mark_read_publishes_a_read_event() {
        when(repository.markAsRead(ALICE, U, "n-1")).thenReturn(1L);

        assertThat(service.markRead(ALICE, U, "n-1")).isTrue();

        assertThat(listener.events).hasSize(1);
        NotificationReadEvent event = listener.events.get(0);
        assertThat(event.recipientId()).isEqualTo(ALICE);
        assertThat(event.recipientType()).isEqualTo(U);
        assertThat(event.notificationIds()).containsExactly("n-1");
        assertThat(event.transition()).isEqualTo(NotificationReadEvent.Transition.READ);
    }

    @Test
    @DisplayName("Given an already-read row, when markRead matches nothing, then NO event fires — repeats and races must not re-trigger retractions")
    void idempotent_mark_read_stays_silent() {
        when(repository.markAsRead(ALICE, U, "n-1")).thenReturn(0L);

        assertThat(service.markRead(ALICE, U, "n-1")).isFalse();

        assertThat(listener.events).isEmpty();
    }

    @Test
    @DisplayName("Given several UNREAD rows, when markAllAsRead flips them, then their ids ride in ONE bulk event, snapshot taken before the flip")
    void mark_all_as_read_publishes_one_bulk_event() {
        when(repository.findByRecipientIdAndRecipientTypeAndStatus(ALICE, U, ReadStatus.UNREAD))
                .thenReturn(List.of(row(ALICE, U, "n-1", ReadStatus.UNREAD), row(ALICE, U, "n-2", ReadStatus.UNREAD)));
        when(repository.markAsReadByIds(any(), eq(ALICE), eq(U), anyCollection())).thenReturn(2L);

        assertThat(service.markAllAsRead(ALICE, U)).isEqualTo(2L);

        assertThat(listener.events).hasSize(1);
        assertThat(listener.events.get(0).notificationIds()).containsExactly("n-1", "n-2");
        assertThat(listener.events.get(0).transition()).isEqualTo(NotificationReadEvent.Transition.READ);
    }

    @Test
    @DisplayName("Given nothing unread, when markAllAsRead runs, then no event fires")
    void mark_all_as_read_with_nothing_unread_stays_silent() {
        when(repository.findByRecipientIdAndRecipientTypeAndStatus(ALICE, U, ReadStatus.UNREAD))
                .thenReturn(List.of());

        assertThat(service.markAllAsRead(ALICE, U)).isZero();

        assertThat(listener.events).isEmpty();
    }

    @Test
    @DisplayName("Given a live row, when deleteNotification soft-deletes it, then the event carries the DELETED transition")
    void delete_publishes_a_deleted_event() {
        when(repository.softDelete(ALICE, U, "n-1")).thenReturn(1L);

        assertThat(service.deleteNotification(ALICE, U, "n-1")).isTrue();

        assertThat(listener.events).hasSize(1);
        assertThat(listener.events.get(0).transition()).isEqualTo(NotificationReadEvent.Transition.DELETED);
        assertThat(listener.events.get(0).notificationIds()).containsExactly("n-1");
    }

    @Test
    @DisplayName("Given READ rows, when deleteAllRead sweeps them, then their ids ride in one DELETED event")
    void delete_all_read_publishes_one_bulk_event() {
        when(repository.findByRecipientIdAndRecipientTypeAndStatus(ALICE, U, ReadStatus.READ))
                .thenReturn(List.of(row(ALICE, U, "n-3", ReadStatus.READ)));
        when(repository.softDeleteByIds(any(), eq(ALICE), eq(U), anyCollection())).thenReturn(1L);

        assertThat(service.deleteAllRead(ALICE, U)).isEqualTo(1L);

        assertThat(listener.events).hasSize(1);
        assertThat(listener.events.get(0).notificationIds()).containsExactly("n-3");
        assertThat(listener.events.get(0).transition()).isEqualTo(NotificationReadEvent.Transition.DELETED);
    }

    @Test
    @DisplayName("Given mixed recipient rows, when dismissForAllRecipients resolves the notification, then only the previously-UNREAD recipients get an event, each their own")
    void dismiss_for_all_publishes_per_unread_recipient() {
        when(repository.findByNotificationId("n-1")).thenReturn(List.of(
                row(ALICE, U, "n-1", ReadStatus.UNREAD),
                row("user-bob", U, "n-1", ReadStatus.READ),
                row("machine-1", RecipientType.MACHINE, "n-1", ReadStatus.UNREAD)));
        when(repository.markAllRecipientsRead("n-1")).thenReturn(2L);

        assertThat(service.dismissForAllRecipients("n-1")).isEqualTo(2L);

        assertThat(listener.events).hasSize(2);
        assertThat(listener.events).extracting(NotificationReadEvent::recipientId)
                .containsExactly(ALICE, "machine-1");
        assertThat(listener.events).allSatisfy(event -> {
            assertThat(event.notificationIds()).containsExactly("n-1");
            assertThat(event.transition()).isEqualTo(NotificationReadEvent.Transition.READ);
        });
    }

    @Test
    @DisplayName("Given a listener that throws, when an event fires, then the next listener still runs and the mutation result is untouched")
    void throwing_listener_neither_breaks_the_mutation_nor_its_neighbours() {
        RecordingListener survivor = new RecordingListener();
        service = service(List.of(event -> {
            throw new IllegalStateException("boom");
        }, survivor));
        when(repository.markAsRead(ALICE, U, "n-1")).thenReturn(1L);

        assertThat(service.markRead(ALICE, U, "n-1")).isTrue();

        assertThat(survivor.events).hasSize(1);
    }

    private static NotificationReadState row(String recipientId, RecipientType type, String notificationId, ReadStatus status) {
        return NotificationReadState.builder()
                .recipientId(recipientId)
                .recipientType(type)
                .notificationId(notificationId)
                .status(status)
                .build();
    }

    private static final class RecordingListener implements NotificationReadEventListener {
        private final List<NotificationReadEvent> events = new ArrayList<>();

        @Override
        public void onReadStateChanged(NotificationReadEvent event) {
            events.add(event);
        }
    }
}
