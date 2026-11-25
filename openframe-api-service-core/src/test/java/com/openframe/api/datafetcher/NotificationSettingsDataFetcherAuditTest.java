package com.openframe.api.datafetcher;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSetting;
import com.openframe.api.dto.NotificationTypeSettingInput;
import com.openframe.api.service.NotificationSettingsService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.notification.NotificationSettingGroup.MINGO_MESSAGES;
import static com.openframe.data.document.notification.NotificationSettingGroup.TICKET_ASSIGNED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationSettingsDataFetcherAuditTest {

    private static final AuthPrincipal TECHNICIAN =
            AuthPrincipal.builder().id("user-1").actorType(ActorType.ADMIN).build();
    private static final AuthPrincipal AGENT =
            AuthPrincipal.builder().id("machine-7").actorType(ActorType.AGENT).build();
    private static final List<NotificationTypeSettingInput> MINGO_MESSAGES_MUTED = List.of(
            new NotificationTypeSettingInput(TICKET_ASSIGNED, true),
            new NotificationTypeSettingInput(MINGO_MESSAGES, false));

    @Mock private NotificationSettingsService service;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private NotificationSettingsDataFetcher fetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    private Object saved;

    @Test
    void updateNotificationSettings_savedWithoutChange_recordsNoChanges() {
        Map<String, AuditChange> changes = changesOfSave(settings(true, false), settings(true, false));

        assertThat(changes).isEmpty();
    }

    @Test
    void updateNotificationSettings_masterSwitchTurnedOff_recordsOnlyTheSwitch() {
        Map<String, AuditChange> changes = changesOfSave(settings(true, false), settings(false, false));

        assertThat(changes).containsExactlyEntriesOf(Map.of("enabled", new AuditChange(true, false)));
    }

    @Test
    void updateNotificationSettings_groupUnticked_recordsOnlyTheMutedGroupsByName() {
        Map<String, AuditChange> changes = changesOfSave(settings(true, true), settings(true, false));

        assertThat(changes).containsExactlyEntriesOf(
                Map.of("mutedGroups", new AuditChange(List.of(), List.of("MINGO_MESSAGES"))));
    }

    @Test
    void updateNotificationSettings_refused_keepsTheAskedSwitchAndMutedGroups() {
        Map<String, Object> details = detailsOfRefusedSave(MINGO_MESSAGES_MUTED);

        assertThat(details).containsExactlyInAnyOrderEntriesOf(
                Map.of("enabled", false, "mutedGroups", List.of(MINGO_MESSAGES)));
    }

    @Test
    void updateNotificationSettings_refusedWithoutTypeSettings_keepsTheAskedSwitch() {
        Map<String, Object> details = detailsOfRefusedSave(null);

        assertThat(details)
                .hasSize(2)
                .containsEntry("enabled", false)
                .containsEntry("mutedGroups", null);
    }

    private Map<String, AuditChange> changesOfSave(NotificationSettingsView before, NotificationSettingsView after) {
        runsTheSave();
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        when(service.get("user-1")).thenReturn(before);
        when(service.update("user-1", after.isEnabled(), MINGO_MESSAGES_MUTED)).thenReturn(after);

        fetcher.updateNotificationSettings(after.isEnabled(), MINGO_MESSAGES_MUTED, TECHNICIAN);

        return recordedCall().changesFromResult().apply(saved);
    }

    private Map<String, Object> detailsOfRefusedSave(List<NotificationTypeSettingInput> typeSettings) {
        runsTheSave();

        assertThatThrownBy(() -> fetcher.updateNotificationSettings(false, typeSettings, AGENT))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("This operation is available to users only, not agents");

        return recordedCall().detailsFromResult().apply(null);
    }

    private void runsTheSave() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            saved = invocation.<AuditedWork<?, ?>>getArgument(1).run();
            return saved;
        });
    }

    private AuditCall recordedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static NotificationSettingsView settings(boolean enabled, boolean mingoMessagesOn) {
        return new NotificationSettingsView(enabled, List.of(
                new NotificationTypeSetting(TICKET_ASSIGNED, "Ticket assigned", true),
                new NotificationTypeSetting(MINGO_MESSAGES, "New messages from Mingo", mingoMessagesOn)));
    }
}
