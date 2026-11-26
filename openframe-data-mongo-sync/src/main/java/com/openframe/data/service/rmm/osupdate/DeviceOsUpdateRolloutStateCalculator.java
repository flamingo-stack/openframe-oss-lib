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
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DeviceOsUpdateRolloutStateCalculator {

    private final OsUpdateUrgencyResolver osUpdateUrgencyResolver;
    private final OsUpdateRolloutStrategyResolver osUpdateRolloutStrategyResolver;
    private final OsUpdateRestartDeadlineCalculator osUpdateRestartDeadlineCalculator;

    // Empty = the policy does not roll the update out: nothing is stored for the device and the update.
    public Optional<DeviceOsUpdateRolloutState> calculate(OsUpdatePolicy osUpdatePolicy, boolean pilotDevice,
                                                          OsUpdate osUpdate,
                                                          DeviceOsPendingUpdate deviceOsPendingUpdate,
                                                          Optional<OsUpdateOverride> osUpdateOverride) {
        Optional<OsUpdateUrgency> osUpdateUrgency = osUpdateUrgencyResolver.resolve(osUpdate);
        Optional<OsUpdateRolloutRule> osUpdateRolloutRule =
                osUpdateUrgency.map(osUpdatePolicy.getRolloutRules()::get);
        if (osUpdateRolloutRule.isEmpty()) {
            return Optional.empty();
        }
        Optional<Instant> installFromByPolicy = osUpdateRolloutStrategyResolver
                .resolve(osUpdateRolloutRule.get().getMode())
                .findInstallFrom(osUpdateRolloutRule.get(), findReleasedAt(osUpdate), pilotDevice);
        Optional<Instant> installFrom = applyOverride(installFromByPolicy, osUpdateOverride);

        DeviceOsUpdateRolloutState deviceOsUpdateRolloutState = DeviceOsUpdateRolloutState.builder()
                .tenantId(deviceOsPendingUpdate.getTenantId())
                .machineId(deviceOsPendingUpdate.getMachineId())
                .platform(deviceOsPendingUpdate.getPlatform())
                .identifier(deviceOsPendingUpdate.getIdentifier())
                .policyId(osUpdatePolicy.getId())
                .overrideAction(osUpdateOverride.map(OsUpdateOverride::getAction).orElse(null))
                .installFrom(installFrom.orElse(null))
                .build();
        installFrom
                .map(from -> osUpdateRestartDeadlineCalculator.calculate(
                        osUpdatePolicy.getRestartDeadlines().get(osUpdateUrgency.get()),
                        deviceOsPendingUpdate.getDiscoveredAt(), from))
                .ifPresent(osUpdateRestartDeadlineDates -> {
                    deviceOsUpdateRolloutState.setFocusAt(osUpdateRestartDeadlineDates.getFocusAt());
                    deviceOsUpdateRolloutState.setSoftAt(osUpdateRestartDeadlineDates.getSoftAt());
                    deviceOsUpdateRolloutState.setHardAt(osUpdateRestartDeadlineDates.getHardAt());
                });
        return Optional.of(deviceOsUpdateRolloutState);
    }

    // The vendor does not date every update: such an update counts from the first report of it in the tenant.
    private Instant findReleasedAt(OsUpdate osUpdate) {
        return Optional.ofNullable(osUpdate.getPublishedAt()).orElse(osUpdate.getFirstSeenAt());
    }

    // An approval never delays what the policy already allows.
    private Optional<Instant> applyOverride(Optional<Instant> installFromByPolicy,
                                            Optional<OsUpdateOverride> osUpdateOverride) {
        if (osUpdateOverride.isEmpty()) {
            return installFromByPolicy;
        }
        if (osUpdateOverride.get().getAction() != OsUpdateOverrideAction.APPROVE) {
            return Optional.empty();
        }
        Instant approvedAt = osUpdateOverride.get().getActedAt();
        return installFromByPolicy
                .filter(byPolicy -> byPolicy.isBefore(approvedAt))
                .or(() -> Optional.of(approvedAt));
    }
}
