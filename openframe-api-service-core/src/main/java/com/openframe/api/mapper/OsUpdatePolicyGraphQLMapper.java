package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyTargetInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRestartDeadlineInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateRolloutRuleInput;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.graphql.relay.RelayIdCodec;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static com.openframe.graphql.relay.NodeType.TAG;

// Tags travel through GraphQL under their global ids and are stored under their raw ones.
@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdatePolicyGraphQLMapper {

    private final RelayIdCodec relayIdCodec;

    public OsUpdatePolicyCommand toCommand(OsUpdatePolicyInput osUpdatePolicyInput) {
        return OsUpdatePolicyCommand.builder()
                .name(osUpdatePolicyInput.getName())
                .target(toTarget(osUpdatePolicyInput.getTarget()))
                .rolloutRules(toRolloutRules(osUpdatePolicyInput.getRolloutRules()))
                .restartDeadlines(toRestartDeadlines(osUpdatePolicyInput.getRestartDeadlines()))
                .pilotTagId(osUpdatePolicyInput.getPilotTagId() == null
                        ? null : relayIdCodec.decode(osUpdatePolicyInput.getPilotTagId(), TAG))
                .build();
    }

    public OsUpdatePolicyResponse toGraphQL(OsUpdatePolicyResponse osUpdatePolicyResponse) {
        OsUpdatePolicyTarget target = osUpdatePolicyResponse.getTarget();
        osUpdatePolicyResponse.setTarget(OsUpdatePolicyTarget.builder()
                .type(target.getType())
                .organizationId(target.getOrganizationId())
                .tagIds(target.getTagIds() == null ? null : target.getTagIds().stream()
                        .map(tagId -> relayIdCodec.encode(TAG, tagId))
                        .toList())
                .machineIds(target.getMachineIds())
                .build());
        if (osUpdatePolicyResponse.getPilotTagId() != null) {
            osUpdatePolicyResponse.setPilotTagId(relayIdCodec.encode(TAG, osUpdatePolicyResponse.getPilotTagId()));
        }
        return osUpdatePolicyResponse;
    }

    private OsUpdatePolicyTarget toTarget(OsUpdatePolicyTargetInput osUpdatePolicyTargetInput) {
        return OsUpdatePolicyTarget.builder()
                .type(osUpdatePolicyTargetInput.getType())
                .organizationId(osUpdatePolicyTargetInput.getOrganizationId())
                .tagIds(osUpdatePolicyTargetInput.getTagIds() == null
                        ? null : relayIdCodec.decodeAll(osUpdatePolicyTargetInput.getTagIds(), TAG))
                .machineIds(osUpdatePolicyTargetInput.getMachineIds())
                .build();
    }

    private Map<OsUpdateUrgency, OsUpdateRolloutRule> toRolloutRules(
            List<OsUpdateRolloutRuleInput> osUpdateRolloutRuleInputs) {
        Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules = new EnumMap<>(OsUpdateUrgency.class);
        for (OsUpdateRolloutRuleInput osUpdateRolloutRuleInput : osUpdateRolloutRuleInputs) {
            OsUpdateRolloutRule replaced = rolloutRules.put(osUpdateRolloutRuleInput.getUrgency(),
                    OsUpdateRolloutRule.builder()
                            .mode(osUpdateRolloutRuleInput.getMode())
                            .daysAfterRelease(osUpdateRolloutRuleInput.getDaysAfterRelease())
                            .daysLaterToEveryone(osUpdateRolloutRuleInput.getDaysLaterToEveryone())
                            .build());
            verifyListedOnce(replaced, "rolloutRules", osUpdateRolloutRuleInput.getUrgency());
        }
        return rolloutRules;
    }

    private Map<OsUpdateUrgency, OsUpdateRestartDeadline> toRestartDeadlines(
            List<OsUpdateRestartDeadlineInput> osUpdateRestartDeadlineInputs) {
        Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines = new EnumMap<>(OsUpdateUrgency.class);
        for (OsUpdateRestartDeadlineInput osUpdateRestartDeadlineInput : osUpdateRestartDeadlineInputs) {
            OsUpdateRestartDeadline replaced = restartDeadlines.put(osUpdateRestartDeadlineInput.getUrgency(),
                    OsUpdateRestartDeadline.builder()
                            .focusDays(osUpdateRestartDeadlineInput.getFocusDays())
                            .softDays(osUpdateRestartDeadlineInput.getSoftDays())
                            .hardDays(osUpdateRestartDeadlineInput.getHardDays())
                            .build());
            verifyListedOnce(replaced, "restartDeadlines", osUpdateRestartDeadlineInput.getUrgency());
        }
        return restartDeadlines;
    }

    private void verifyListedOnce(Object replaced, String field, OsUpdateUrgency urgency) {
        if (replaced != null) {
            throw new ValidationException(field + " lists " + urgency + " twice");
        }
    }
}
