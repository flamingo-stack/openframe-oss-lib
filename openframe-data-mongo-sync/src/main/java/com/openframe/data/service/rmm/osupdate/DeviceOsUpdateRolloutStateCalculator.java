package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class DeviceOsUpdateRolloutStateCalculator {

    private final OsUpdateUrgencyResolver osUpdateUrgencyResolver;
    private final OsUpdateRolloutStrategyResolver osUpdateRolloutStrategyResolver;
    private final OsUpdateRestartDeadlineCalculator osUpdateRestartDeadlineCalculator;

    // Null = the policy does not roll the update out: nothing is stored for the device and the update.
    // osUpdateOverride is null when no technician decided on the update for this device.
    public DeviceOsUpdateRolloutState calculate(OsUpdatePolicy osUpdatePolicy, boolean pilotDevice, OsUpdate osUpdate,
                                                DeviceOsPendingUpdate deviceOsPendingUpdate,
                                                OsUpdateOverride osUpdateOverride) {
        OsUpdateUrgency osUpdateUrgency = osUpdateUrgencyResolver.resolve(osUpdate);
        OsUpdateRolloutRule osUpdateRolloutRule =
                osUpdateUrgency == null ? null : osUpdatePolicy.getRolloutRules().get(osUpdateUrgency);
        if (osUpdateRolloutRule == null) {
            return null;
        }
        Instant installFromByPolicy = osUpdateRolloutStrategyResolver
                .resolve(osUpdateRolloutRule.getMode())
                .findInstallFrom(osUpdateRolloutRule, findReleasedAt(osUpdate), pilotDevice);
        Instant installFrom = applyOverride(installFromByPolicy, osUpdateOverride);
        DeviceOsUpdateRolloutState deviceOsUpdateRolloutState = DeviceOsUpdateRolloutState.builder()
                .tenantId(deviceOsPendingUpdate.getTenantId())
                .machineId(deviceOsPendingUpdate.getMachineId())
                .platform(deviceOsPendingUpdate.getPlatform())
                .identifier(deviceOsPendingUpdate.getIdentifier())
                .policyId(osUpdatePolicy.getId())
                .overrideAction(osUpdateOverride == null ? null : osUpdateOverride.getAction())
                .installFrom(installFrom)
                .build();
        if (installFrom != null) {
            OsUpdateRestartDeadlineDates osUpdateRestartDeadlineDates = osUpdateRestartDeadlineCalculator.calculate(
                    osUpdatePolicy.getRestartDeadlines().get(osUpdateUrgency),
                    deviceOsPendingUpdate.getDiscoveredAt(), installFrom);
            deviceOsUpdateRolloutState.setFocusAt(osUpdateRestartDeadlineDates.getFocusAt());
            deviceOsUpdateRolloutState.setSoftAt(osUpdateRestartDeadlineDates.getSoftAt());
            deviceOsUpdateRolloutState.setHardAt(osUpdateRestartDeadlineDates.getHardAt());
        }
        return deviceOsUpdateRolloutState;
    }

    // The vendor does not date every update: such an update counts from the first report of it in the tenant.
    private Instant findReleasedAt(OsUpdate osUpdate) {
        return osUpdate.getPublishedAt() != null ? osUpdate.getPublishedAt() : osUpdate.getFirstSeenAt();
    }

    // An approval never delays what the policy already allows.
    private Instant applyOverride(Instant installFromByPolicy, OsUpdateOverride osUpdateOverride) {
        if (osUpdateOverride == null) {
            return installFromByPolicy;
        }
        if (osUpdateOverride.getAction() != OsUpdateOverrideAction.APPROVE) {
            return null;
        }
        Instant approvedAt = osUpdateOverride.getActedAt();
        return installFromByPolicy != null && installFromByPolicy.isBefore(approvedAt)
                ? installFromByPolicy
                : approvedAt;
    }
}
