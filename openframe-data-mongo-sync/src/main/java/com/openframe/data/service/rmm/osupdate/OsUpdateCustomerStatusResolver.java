package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;

// The status of an update at a customer is read from the policy and the decisions of the customer's scope, never
// from the rollout states of its devices: a device under a tag or device policy follows that policy's days.
@Component
@RequiredArgsConstructor
public class OsUpdateCustomerStatusResolver {

    private final OsUpdatePolicyResolver osUpdatePolicyResolver;
    private final OsUpdateOverrideResolver osUpdateOverrideResolver;
    private final OsUpdateUrgencyResolver osUpdateUrgencyResolver;
    private final OsUpdateRolloutStrategyResolver osUpdateRolloutStrategyResolver;
    private final OsUpdateReleasedAtResolver osUpdateReleasedAtResolver;

    public OsUpdateCustomerRollout resolve(Collection<OsUpdatePolicy> osUpdatePolicies,
                                           Collection<OsUpdateOverride> overridesOfOsUpdate, OsUpdate osUpdate,
                                           String organizationId, Instant now) {
        OsUpdatePolicy osUpdatePolicy = osUpdatePolicyResolver.resolveOfCustomer(osUpdatePolicies, organizationId);
        OsUpdateUrgency osUpdateUrgency = osUpdateUrgencyResolver.resolve(osUpdate);
        OsUpdateRolloutRule osUpdateRolloutRule = osUpdatePolicy == null || osUpdateUrgency == null
                ? null
                : osUpdatePolicy.getRolloutRules().get(osUpdateUrgency);
        OsUpdateOverride osUpdateOverride =
                osUpdateOverrideResolver.resolveOfCustomer(overridesOfOsUpdate, organizationId);
        return OsUpdateCustomerRollout.builder()
                .osUpdateCustomerStatus(resolveStatus(osUpdateRolloutRule, osUpdateOverride, osUpdate, now))
                .osUpdatePolicy(osUpdatePolicy)
                .osUpdateUrgency(osUpdateUrgency)
                .osUpdateRolloutRule(osUpdateRolloutRule)
                .osUpdateOverride(osUpdateOverride)
                .build();
    }

    // A decision of a technician stands only on an update the policy rolls out: without a rule the update is
    // only listed, whatever was decided.
    private OsUpdateCustomerStatus resolveStatus(OsUpdateRolloutRule osUpdateRolloutRule,
                                                 OsUpdateOverride osUpdateOverride, OsUpdate osUpdate, Instant now) {
        if (osUpdateRolloutRule == null) {
            return OsUpdateCustomerStatus.LISTED_ONLY;
        }
        if (osUpdateOverride != null) {
            return switch (osUpdateOverride.getAction()) {
                case APPROVE -> OsUpdateCustomerStatus.APPROVED;
                case HOLD -> OsUpdateCustomerStatus.HELD;
                case REJECT -> OsUpdateCustomerStatus.REJECTED;
            };
        }
        OsUpdateRolloutStrategy osUpdateRolloutStrategy =
                osUpdateRolloutStrategyResolver.resolve(osUpdateRolloutRule.getMode());
        Instant releasedAt = osUpdateReleasedAtResolver.resolve(osUpdate);
        Instant everyoneInstallFrom = osUpdateRolloutStrategy.findInstallFrom(osUpdateRolloutRule, releasedAt, false);
        if (everyoneInstallFrom == null) {
            return OsUpdateCustomerStatus.HELD;
        }
        if (!everyoneInstallFrom.isAfter(now)) {
            return OsUpdateCustomerStatus.APPROVED;
        }
        Instant pilotInstallFrom = osUpdateRolloutStrategy.findInstallFrom(osUpdateRolloutRule, releasedAt, true);
        return pilotInstallFrom.isBefore(everyoneInstallFrom) && !pilotInstallFrom.isAfter(now)
                ? OsUpdateCustomerStatus.PILOT
                : OsUpdateCustomerStatus.SCHEDULED;
    }
}
