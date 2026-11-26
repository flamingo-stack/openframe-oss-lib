package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateRolloutStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceClassRestartModeResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateMaintenanceWindowResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateMaintenanceWindow;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdatePolicyResponseMapperTest {

    private static final Instant NOW = Instant.parse("2026-10-20T12:00:00Z");

    private final OsUpdatePolicyResponseMapper osUpdatePolicyResponseMapper = new OsUpdatePolicyResponseMapper();

    @Test
    void toResponse_installFromAhead_scheduled() {
        assertThat(statusOf(NOW.plusSeconds(1), null)).isEqualTo(DeviceOsUpdateRolloutStatus.SCHEDULED);
    }

    @Test
    void toResponse_installFromHasCome_approved() {
        assertThat(statusOf(NOW, null)).isEqualTo(DeviceOsUpdateRolloutStatus.APPROVED);
    }

    @Test
    void toResponse_noInstallFromByThePolicyOrByAHold_held() {
        assertThat(statusOf(null, null)).isEqualTo(DeviceOsUpdateRolloutStatus.HELD);
        assertThat(statusOf(null, OsUpdateOverrideAction.HOLD)).isEqualTo(DeviceOsUpdateRolloutStatus.HELD);
    }

    @Test
    void toResponse_noInstallFromByAReject_rejected() {
        assertThat(statusOf(null, OsUpdateOverrideAction.REJECT)).isEqualTo(DeviceOsUpdateRolloutStatus.REJECTED);
    }

    @Test
    void toResponse_policy_rulesAndDeadlinesInTheOrderOfUrgency() {
        // setup
        OsUpdatePolicy osUpdatePolicy = OsUpdatePolicy.builder()
                .id("policy-1")
                .rolloutRules(Map.of(
                        OsUpdateUrgency.QUALITY,
                        OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build(),
                        OsUpdateUrgency.CRITICAL_SECURITY,
                        OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.EVERYONE_AT_ONCE)
                                .daysAfterRelease(0).build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.CRITICAL_SECURITY,
                        OsUpdateRestartDeadline.builder().focusDays(0).softDays(1).hardDays(2).build()))
                .build();

        // execution
        OsUpdatePolicyResponse response = osUpdatePolicyResponseMapper.toResponse(osUpdatePolicy);

        // verifications
        assertThat(response.getRolloutRules()).extracting(OsUpdateRolloutRuleResponse::getUrgency)
                .containsExactly(OsUpdateUrgency.CRITICAL_SECURITY, OsUpdateUrgency.QUALITY);
        assertThat(response.getRolloutRules().getFirst().getDaysAfterRelease()).isZero();
        assertThat(response.getRestartDeadlines()).singleElement()
                .satisfies(restartDeadline -> assertThat(restartDeadline.getHardDays()).isEqualTo(2));
    }

    private DeviceOsUpdateRolloutStatus statusOf(Instant installFrom, OsUpdateOverrideAction overrideAction) {
        DeviceOsUpdateRolloutState deviceOsUpdateRolloutState = DeviceOsUpdateRolloutState.builder()
                .policyId("policy-1").installFrom(installFrom).overrideAction(overrideAction).build();
        return osUpdatePolicyResponseMapper.toResponse(deviceOsUpdateRolloutState, NOW).getStatus();
    }

    @Test
    void toResponse_policy_windowsAndRestartModesInTheOrderOfDeviceClass() {
        // setup
        OsUpdatePolicy osUpdatePolicy = OsUpdatePolicy.builder()
                .rolloutRules(Map.of()).restartDeadlines(Map.of())
                .maintenanceWindows(Map.of(
                        OsUpdateDeviceClass.SERVER, OsUpdateMaintenanceWindow.builder()
                                .daysOfWeek(List.of(DayOfWeek.SATURDAY)).fromTime("03:00").toTime("06:00").build(),
                        OsUpdateDeviceClass.WORKSTATION, OsUpdateMaintenanceWindow.builder()
                                .daysOfWeek(List.of(DayOfWeek.TUESDAY)).fromTime("01:00").toTime("04:00").build()))
                .restartModes(Map.of(
                        OsUpdateDeviceClass.SERVER, OsUpdateRestartMode.NEVER,
                        OsUpdateDeviceClass.WORKSTATION, OsUpdateRestartMode.DIALOG_THEN_DEADLINES))
                .build();

        // execution
        OsUpdatePolicyResponse response = osUpdatePolicyResponseMapper.toResponse(osUpdatePolicy);

        // verifications
        assertThat(response.getMaintenanceWindows()).containsExactly(
                OsUpdateMaintenanceWindowResponse.builder().deviceClass(OsUpdateDeviceClass.WORKSTATION)
                        .daysOfWeek(List.of(DayOfWeek.TUESDAY)).fromTime("01:00").toTime("04:00").build(),
                OsUpdateMaintenanceWindowResponse.builder().deviceClass(OsUpdateDeviceClass.SERVER)
                        .daysOfWeek(List.of(DayOfWeek.SATURDAY)).fromTime("03:00").toTime("06:00").build());
        assertThat(response.getRestartModes()).containsExactly(
                OsUpdateDeviceClassRestartModeResponse.builder().deviceClass(OsUpdateDeviceClass.WORKSTATION)
                        .mode(OsUpdateRestartMode.DIALOG_THEN_DEADLINES).build(),
                OsUpdateDeviceClassRestartModeResponse.builder().deviceClass(OsUpdateDeviceClass.SERVER)
                        .mode(OsUpdateRestartMode.NEVER).build());
    }

    @Test
    void toResponse_policySavedBeforeTheSettingsExisted_emptyListsAndNoRules() {
        // setup
        OsUpdatePolicy osUpdatePolicy = OsUpdatePolicy.builder()
                .rolloutRules(Map.of()).restartDeadlines(Map.of())
                .build();

        // execution
        OsUpdatePolicyResponse response = osUpdatePolicyResponseMapper.toResponse(osUpdatePolicy);

        // verifications
        assertThat(response.getMaintenanceWindows()).isEmpty();
        assertThat(response.getRestartModes()).isEmpty();
        assertThat(response.getOfflineRule()).isNull();
        assertThat(response.getInUseRule()).isNull();
        assertThat(response.isDomainControllerRestartManual()).isFalse();
        assertThat(response.getRestartDialog()).isNull();
    }
}
