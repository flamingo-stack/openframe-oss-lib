package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateRolloutStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateRolloutStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateOverrideResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRestartDeadlineResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleResponse;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class OsUpdatePolicyResponseMapper {

    public OsUpdatePolicyResponse toResponse(OsUpdatePolicy osUpdatePolicy) {
        return OsUpdatePolicyResponse.builder()
                .id(osUpdatePolicy.getId())
                .name(osUpdatePolicy.getName())
                .target(osUpdatePolicy.getTarget())
                .rolloutRules(toRolloutRules(osUpdatePolicy))
                .restartDeadlines(toRestartDeadlines(osUpdatePolicy))
                .pilotTagId(osUpdatePolicy.getPilotTagId())
                .createdAt(osUpdatePolicy.getCreatedAt())
                .updatedAt(osUpdatePolicy.getUpdatedAt())
                .build();
    }

    public OsUpdateOverrideResponse toResponse(OsUpdateOverride osUpdateOverride) {
        return OsUpdateOverrideResponse.builder()
                .action(osUpdateOverride.getAction())
                .organizationId(osUpdateOverride.getOrganizationId())
                .machineId(osUpdateOverride.getMachineId())
                .actedBy(osUpdateOverride.getActedBy())
                .actedAt(osUpdateOverride.getActedAt())
                .build();
    }

    // The status is the stored dates read at the given moment: nothing moves it but time.
    public DeviceOsUpdateRolloutStateResponse toResponse(DeviceOsUpdateRolloutState deviceOsUpdateRolloutState,
                                                         Instant now) {
        return DeviceOsUpdateRolloutStateResponse.builder()
                .policyId(deviceOsUpdateRolloutState.getPolicyId())
                .status(toStatus(deviceOsUpdateRolloutState, now))
                .overrideAction(deviceOsUpdateRolloutState.getOverrideAction())
                .installFrom(deviceOsUpdateRolloutState.getInstallFrom())
                .focusAt(deviceOsUpdateRolloutState.getFocusAt())
                .softAt(deviceOsUpdateRolloutState.getSoftAt())
                .hardAt(deviceOsUpdateRolloutState.getHardAt())
                .build();
    }

    private DeviceOsUpdateRolloutStatus toStatus(DeviceOsUpdateRolloutState deviceOsUpdateRolloutState, Instant now) {
        Instant installFrom = deviceOsUpdateRolloutState.getInstallFrom();
        if (installFrom == null) {
            return deviceOsUpdateRolloutState.getOverrideAction() == OsUpdateOverrideAction.REJECT
                    ? DeviceOsUpdateRolloutStatus.REJECTED
                    : DeviceOsUpdateRolloutStatus.HELD;
        }
        return installFrom.isAfter(now) ? DeviceOsUpdateRolloutStatus.SCHEDULED : DeviceOsUpdateRolloutStatus.APPROVED;
    }

    private List<OsUpdateRolloutRuleResponse> toRolloutRules(OsUpdatePolicy osUpdatePolicy) {
        return Arrays.stream(OsUpdateUrgency.values())
                .filter(osUpdatePolicy.getRolloutRules()::containsKey)
                .map(urgency -> OsUpdateRolloutRuleResponse.builder()
                        .urgency(urgency)
                        .mode(osUpdatePolicy.getRolloutRules().get(urgency).getMode())
                        .daysAfterRelease(osUpdatePolicy.getRolloutRules().get(urgency).getDaysAfterRelease())
                        .daysLaterToEveryone(osUpdatePolicy.getRolloutRules().get(urgency).getDaysLaterToEveryone())
                        .build())
                .toList();
    }

    private List<OsUpdateRestartDeadlineResponse> toRestartDeadlines(OsUpdatePolicy osUpdatePolicy) {
        return Arrays.stream(OsUpdateUrgency.values())
                .filter(osUpdatePolicy.getRestartDeadlines()::containsKey)
                .map(urgency -> OsUpdateRestartDeadlineResponse.builder()
                        .urgency(urgency)
                        .focusDays(osUpdatePolicy.getRestartDeadlines().get(urgency).getFocusDays())
                        .softDays(osUpdatePolicy.getRestartDeadlines().get(urgency).getSoftDays())
                        .hardDays(osUpdatePolicy.getRestartDeadlines().get(urgency).getHardDays())
                        .build())
                .toList();
    }
}
