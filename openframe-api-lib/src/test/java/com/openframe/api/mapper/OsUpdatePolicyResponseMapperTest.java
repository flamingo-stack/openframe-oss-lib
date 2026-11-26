package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateRolloutStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.junit.jupiter.api.Test;

import java.time.Instant;
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
}
