package com.openframe.data.nats.service;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContextDescriptorRegistry;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import com.openframe.data.repository.notification.NotificationRepository;
import com.openframe.data.service.notification.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationBroadcasterTest {

    private NotificationRepository notificationRepository;
    private NotificationReadStateService readStateService;
    private NotificationContextDescriptorRegistry descriptorRegistry;
    private NotificationNatsPublisher natsPublisher;
    private NotificationBroadcaster broadcaster;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        readStateService = mock(NotificationReadStateService.class);
        descriptorRegistry = mock(NotificationContextDescriptorRegistry.class);
        natsPublisher = mock(NotificationNatsPublisher.class);
        broadcaster = newBroadcaster(Optional.of(natsPublisher), true);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> {
            Notification arg = inv.getArgument(0);
            arg.setId("notif-id-1");
            return arg;
        });
        when(descriptorRegistry.categoryOf(anyString())).thenReturn(NotificationCategory.MINGO);
    }

    @Test
    @DisplayName("Given a command with only adminAudience, when broadcast is called, then a Notification is persisted, USER read_state rows are created for each admin, and publishToUser fires per admin — no machine-side calls")
    void admin_only_command_fans_out_to_admin_path() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval required")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1", "admin-2"))
                .build();

        broadcaster.broadcast(cmd);

        verify(readStateService, times(1)).createForAudience(
                eq("notif-id-1"), eq(NotificationCategory.MINGO), anyString(), eq(RecipientType.USER), eq(Set.of("admin-1", "admin-2")));
        verify(readStateService, never()).createForAudience(
                anyString(), any(NotificationCategory.class), anyString(), eq(RecipientType.MACHINE), any());
        verify(natsPublisher).publishToUser(eq("admin-1"), any(Notification.class), eq(NotificationCategory.MINGO));
        verify(natsPublisher).publishToUser(eq("admin-2"), any(Notification.class), eq(NotificationCategory.MINGO));
        verify(natsPublisher, never()).publishToMachine(anyString(), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given a command with only machineAudience, when broadcast is called, then a Notification is persisted, MACHINE read_state rows are created and publishToMachine fires per machine — no admin-side calls")
    void machine_only_command_fans_out_to_machine_path() {
        when(descriptorRegistry.categoryOf("TICKET_STATUS_CHANGED")).thenReturn(NotificationCategory.TICKETS);
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Ticket update")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("TICKET_STATUS_CHANGED"))
                .machineAudience(Set.of("m-1", "m-2"))
                .build();

        broadcaster.broadcast(cmd);

        verify(readStateService, times(1)).createForAudience(
                eq("notif-id-1"), eq(NotificationCategory.TICKETS), anyString(), eq(RecipientType.MACHINE), eq(Set.of("m-1", "m-2")));
        verify(readStateService, never()).createForAudience(
                anyString(), any(NotificationCategory.class), anyString(), eq(RecipientType.USER), any());
        verify(natsPublisher).publishToMachine(eq("m-1"), any(Notification.class), eq(NotificationCategory.TICKETS));
        verify(natsPublisher).publishToMachine(eq("m-2"), any(Notification.class), eq(NotificationCategory.TICKETS));
        verify(natsPublisher, never()).publishToUser(anyString(), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given a command carrying both admin and machine audiences, when broadcast is called, then two separate createForAudience invocations (one per RecipientType) and both publish loops fire")
    void mixed_audience_fans_out_to_both_paths() {
        when(descriptorRegistry.categoryOf("TICKET_STATUS_CHANGED")).thenReturn(NotificationCategory.TICKETS);
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Ticket status changed")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("TICKET_STATUS_CHANGED"))
                .adminAudience(Set.of("admin-1"))
                .machineAudience(Set.of("m-1"))
                .build();

        broadcaster.broadcast(cmd);

        verify(readStateService).createForAudience(
                eq("notif-id-1"), eq(NotificationCategory.TICKETS), anyString(), eq(RecipientType.USER), eq(Set.of("admin-1")));
        verify(readStateService).createForAudience(
                eq("notif-id-1"), eq(NotificationCategory.TICKETS), anyString(), eq(RecipientType.MACHINE), eq(Set.of("m-1")));
        verify(natsPublisher).publishToUser(eq("admin-1"), any(Notification.class), eq(NotificationCategory.TICKETS));
        verify(natsPublisher).publishToMachine(eq("m-1"), any(Notification.class), eq(NotificationCategory.TICKETS));
    }

    @Test
    @DisplayName("Given the NATS publisher dependency is absent (Optional.empty), when broadcast is called, then the Notification is still persisted and read_state rows are created — clients reconcile via GraphQL catch-up")
    void no_publisher_persists_without_nats() {
        NotificationBroadcaster bcWithoutNats = newBroadcaster(Optional.empty(), true);
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1"))
                .build();

        Notification result = bcWithoutNats.broadcast(cmd);

        assertThat(result.getId()).isEqualTo("notif-id-1");
        verify(notificationRepository).save(any(Notification.class));
        verify(readStateService).createForAudience(
                eq("notif-id-1"), eq(NotificationCategory.MINGO), anyString(), eq(RecipientType.USER), eq(Set.of("admin-1")));
        verifyNoInteractions(natsPublisher);
    }

    @Test
    @DisplayName("Given a command, when broadcast persists the Notification, then title, description, severity and context are copied from the Command verbatim onto the document passed to save()")
    void persisted_notification_carries_command_fields() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Bulk approval")
                .description("Requested by 3 admins")
                .severity(NotificationSeverity.WARNING)
                .context(genericContext("BULK_APPROVAL"))
                .adminAudience(Set.of("admin-1"))
                .build();

        broadcaster.broadcast(cmd);

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        Notification persisted = captor.getValue();
        assertThat(persisted.getTitle()).isEqualTo("Bulk approval");
        assertThat(persisted.getDescription()).isEqualTo("Requested by 3 admins");
        assertThat(persisted.getSeverity()).isEqualTo(NotificationSeverity.WARNING);
        assertThat(persisted.getContext().getType()).isEqualTo("BULK_APPROVAL");
    }

    @Test
    @DisplayName("Given a command, when broadcast returns, then the returned Notification is the saved one (with id populated) — caller must rely on the persisted id, not on a builder-only object")
    void broadcast_returns_persisted_notification() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(Set.of("admin-1"))
                .build();

        Notification result = broadcaster.broadcast(cmd);

        assertThat(result.getId()).isEqualTo("notif-id-1");
    }

    @Test
    @DisplayName("Given a command, when broadcast is called, then NotificationReadState is created with category resolved from the descriptor registry by context.type — denormalization keeps unreadCountsByCategory aggregation lookup-free")
    void category_resolved_from_registry_and_denormalized_into_read_state() {
        when(descriptorRegistry.categoryOf("TICKET_STATUS_CHANGED")).thenReturn(NotificationCategory.TICKETS);
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Ticket status")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("TICKET_STATUS_CHANGED"))
                .adminAudience(Set.of("admin-1"))
                .build();

        broadcaster.broadcast(cmd);

        verify(readStateService).createForAudience(
                anyString(), eq(NotificationCategory.TICKETS), anyString(), eq(RecipientType.USER), any());
    }

    @Test
    @DisplayName("Given createForAudience throws a non-dup-key RuntimeException, when broadcast is called, then the just-persisted Notification doc is deleted by id and the exception is re-thrown — invisible orphans are not left behind and NATS publish is skipped")
    void create_for_audience_failure_triggers_orphan_cleanup_and_skips_nats() {
        doThrow(new RuntimeException("mongo down")).when(readStateService).createForAudience(
                anyString(), any(NotificationCategory.class), anyString(), eq(RecipientType.USER), any());
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1"))
                .build();

        assertThatThrownBy(() -> broadcaster.broadcast(cmd))
                .isInstanceOf(RuntimeException.class)
                .hasMessage("mongo down");

        verify(notificationRepository).deleteById("notif-id-1");
        verifyNoInteractions(natsPublisher);
    }

    @Test
    @DisplayName("Given the NATS publisher throws RuntimeException for one recipient, when broadcast is called, then subsequent recipients still receive publishToUser/publishToMachine — one bad send does not poison the loop")
    void nats_publish_failure_for_one_recipient_does_not_skip_others() {
        doThrow(new RuntimeException("nats reject")).when(natsPublisher).publishToUser(eq("admin-1"), any(Notification.class), any(NotificationCategory.class));
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1", "admin-2", "admin-3"))
                .machineAudience(Set.of("m-1"))
                .build();

        broadcaster.broadcast(cmd);

        verify(natsPublisher).publishToUser(eq("admin-1"), any(Notification.class), any(NotificationCategory.class));
        verify(natsPublisher).publishToUser(eq("admin-2"), any(Notification.class), any(NotificationCategory.class));
        verify(natsPublisher).publishToUser(eq("admin-3"), any(Notification.class), any(NotificationCategory.class));
        verify(natsPublisher).publishToMachine(eq("m-1"), any(Notification.class), any(NotificationCategory.class));
    }

    @Test
    @DisplayName("Given the notifications feature flag is disabled, when broadcast is called, then nothing is persisted or published and null is returned — the feature stays fully dormant")
    void disabled_feature_flag_makes_broadcast_a_noop() {
        NotificationBroadcaster disabled = newBroadcaster(Optional.of(natsPublisher), false);
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval required")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1"))
                .build();

        Notification result = disabled.broadcast(cmd);

        assertThat(result).isNull();
        verifyNoInteractions(notificationRepository, readStateService, natsPublisher);
    }

    private NotificationBroadcaster newBroadcaster(Optional<NotificationNatsPublisher> publisher, boolean notificationsEnabled) {
        NotificationBroadcaster bc = new NotificationBroadcaster(
                notificationRepository, readStateService, descriptorRegistry, publisher);
        ReflectionTestUtils.setField(bc, "notificationsEnabled", notificationsEnabled);
        return bc;
    }

    private static GenericContext genericContext(String type) {
        return GenericContext.builder().type(type).payload("{}").build();
    }
}
