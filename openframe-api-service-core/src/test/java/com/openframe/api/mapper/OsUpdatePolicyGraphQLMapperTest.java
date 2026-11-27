package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceClassRestartModeInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateMaintenanceWindowInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyTargetInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRestartDeadlineInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleInput;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeferOption;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateMaintenanceWindow;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

import static com.openframe.graphql.relay.NodeType.TAG;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OsUpdatePolicyGraphQLMapperTest {

    @Mock private RelayIdCodec relayIdCodec;

    @InjectMocks private OsUpdatePolicyGraphQLMapper osUpdatePolicyGraphQLMapper;

    private OsUpdatePolicyInput input;

    @BeforeEach
    void setUp() {
        input = OsUpdatePolicyInput.builder()
                .name("Kiosks")
                .target(OsUpdatePolicyTargetInput.builder()
                        .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("global-a")).build())
                .rolloutRules(List.of(OsUpdateRolloutRuleInput.builder()
                        .urgency(OsUpdateUrgency.QUALITY).mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE)
                        .daysAfterRelease(7).daysLaterToEveryone(14).build()))
                .restartDeadlines(List.of(OsUpdateRestartDeadlineInput.builder()
                        .urgency(OsUpdateUrgency.QUALITY).focusDays(1).softDays(5).hardDays(7).build()))
                .pilotTagId("global-pilot")
                .maintenanceWindows(List.of(
                        OsUpdateMaintenanceWindowInput.builder().deviceClass(OsUpdateDeviceClass.WORKSTATION)
                                .daysOfWeek(List.of(DayOfWeek.TUESDAY)).fromTime("01:00").toTime("04:00").build(),
                        OsUpdateMaintenanceWindowInput.builder().deviceClass(OsUpdateDeviceClass.SERVER)
                                .daysOfWeek(List.of(DayOfWeek.SATURDAY)).fromTime("03:00").toTime("06:00").build()))
                .offlineRule(OsUpdateOfflineRule.WAIT_FOR_NEXT_WINDOW)
                .inUseRule(OsUpdateInUseRule.SKIP_WINDOW)
                .domainControllerRestartManual(true)
                .restartModes(List.of(
                        OsUpdateDeviceClassRestartModeInput.builder().deviceClass(OsUpdateDeviceClass.WORKSTATION)
                                .mode(OsUpdateRestartMode.DIALOG_THEN_DEADLINES).build(),
                        OsUpdateDeviceClassRestartModeInput.builder().deviceClass(OsUpdateDeviceClass.SERVER)
                                .mode(OsUpdateRestartMode.NEVER).build()))
                .restartDialog(OsUpdateRestartDialog.builder()
                        .deferOptions(List.of(OsUpdateDeferOption.ONE_HOUR)).autoAnswerMinutes(60).build())
                .build();
        when(relayIdCodec.decodeAll(List.of("global-a"), TAG)).thenReturn(List.of("tag-a"));
        when(relayIdCodec.decode("global-pilot", TAG)).thenReturn("tag-pilot");
        when(relayIdCodec.encode(TAG, "tag-a")).thenReturn("global-a");
        when(relayIdCodec.encode(TAG, "tag-pilot")).thenReturn("global-pilot");
    }

    @Test
    void toCommand_input_rulesKeyedByUrgencyAndTagsUnderTheirRawIds() {
        // execution
        OsUpdatePolicyCommand command = osUpdatePolicyGraphQLMapper.toCommand(input);

        // verifications
        assertThat(command.getName()).isEqualTo("Kiosks");
        assertThat(command.getTarget().getTagIds()).containsExactly("tag-a");
        assertThat(command.getPilotTagId()).isEqualTo("tag-pilot");
        assertThat(command.getRolloutRules().get(OsUpdateUrgency.QUALITY).getDaysLaterToEveryone()).isEqualTo(14);
        assertThat(command.getRestartDeadlines().get(OsUpdateUrgency.QUALITY).getHardDays()).isEqualTo(7);
    }

    @Test
    void toCommand_urgencyListedTwice_refused() {
        // setup
        input.setRolloutRules(List.of(input.getRolloutRules().getFirst(), input.getRolloutRules().getFirst()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("QUALITY");
    }

    @Test
    void toCommand_restartDeadlineUrgencyListedTwice_refused() {
        // setup
        input.setRestartDeadlines(
                List.of(input.getRestartDeadlines().getFirst(), input.getRestartDeadlines().getFirst()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("restartDeadlines");
    }

    @Test
    void toCommand_inputWithoutAPilotTag_noPilotTagAndNothingDecodedForIt() {
        // setup
        input.setPilotTagId(null);

        // execution
        OsUpdatePolicyCommand command = osUpdatePolicyGraphQLMapper.toCommand(input);

        // verifications
        assertThat(command.getPilotTagId()).isNull();
    }

    @Test
    void toCommand_input_windowsAndRestartModesKeyedByDeviceClassAndTheOtherSettingsAsGiven() {
        // execution
        OsUpdatePolicyCommand command = osUpdatePolicyGraphQLMapper.toCommand(input);

        // verifications
        assertThat(command.getMaintenanceWindows()).containsOnlyKeys(OsUpdateDeviceClass.values());
        assertThat(command.getMaintenanceWindows().get(OsUpdateDeviceClass.SERVER)).isEqualTo(
                OsUpdateMaintenanceWindow.builder()
                        .daysOfWeek(List.of(DayOfWeek.SATURDAY)).fromTime("03:00").toTime("06:00").build());
        assertThat(command.getRestartModes()).containsExactlyInAnyOrderEntriesOf(Map.of(
                OsUpdateDeviceClass.WORKSTATION, OsUpdateRestartMode.DIALOG_THEN_DEADLINES,
                OsUpdateDeviceClass.SERVER, OsUpdateRestartMode.NEVER));
        assertThat(command.getOfflineRule()).isEqualTo(OsUpdateOfflineRule.WAIT_FOR_NEXT_WINDOW);
        assertThat(command.getInUseRule()).isEqualTo(OsUpdateInUseRule.SKIP_WINDOW);
        assertThat(command.isDomainControllerRestartManual()).isTrue();
        assertThat(command.getRestartDialog()).isEqualTo(input.getRestartDialog());
    }

    @Test
    void toCommand_deviceClassListedTwiceInTheWindows_refused() {
        // setup
        input.setMaintenanceWindows(
                List.of(input.getMaintenanceWindows().getFirst(), input.getMaintenanceWindows().getFirst()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessage("maintenanceWindows lists WORKSTATION twice");
    }

    @Test
    void toCommand_deviceClassListedTwiceInTheRestartModes_refused() {
        // setup
        input.setRestartModes(List.of(input.getRestartModes().getLast(), input.getRestartModes().getLast()));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyGraphQLMapper.toCommand(input))
                .isInstanceOf(ValidationException.class)
                .hasMessage("restartModes lists SERVER twice");
    }

    @Test
    void toGraphQL_response_tagsUnderTheirGlobalIds() {
        // setup
        OsUpdatePolicyResponse response = OsUpdatePolicyResponse.builder()
                .target(OsUpdatePolicyTarget.builder()
                        .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-a")).build())
                .pilotTagId("tag-pilot")
                .build();

        // execution
        OsUpdatePolicyResponse graphQL = osUpdatePolicyGraphQLMapper.toGraphQL(response);

        // verifications
        assertThat(graphQL.getTarget().getTagIds()).containsExactly("global-a");
        assertThat(graphQL.getPilotTagId()).isEqualTo("global-pilot");
    }
}
