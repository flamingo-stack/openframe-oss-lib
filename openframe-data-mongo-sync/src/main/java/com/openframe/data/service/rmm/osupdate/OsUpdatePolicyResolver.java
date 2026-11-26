package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Component
public class OsUpdatePolicyResolver {

    private static final List<OsUpdatePolicyTargetType> MOST_SPECIFIC_FIRST = List.of(
            OsUpdatePolicyTargetType.DEVICE,
            OsUpdatePolicyTargetType.DEVICE_TAG,
            OsUpdatePolicyTargetType.CUSTOMER,
            OsUpdatePolicyTargetType.TENANT);

    // The policy that applies to the device: the most specific of those that cover it, the earliest created one
    // of two equally specific. Null = no policy covers the device.
    public OsUpdatePolicy resolve(Collection<OsUpdatePolicy> osUpdatePolicies, Machine machine,
                                  Set<String> machineTagIds) {
        return MOST_SPECIFIC_FIRST.stream()
                .map(targetType -> findEarliestCovering(osUpdatePolicies, targetType, machine, machineTagIds))
                .flatMap(Optional::stream)
                .findFirst()
                .orElse(null);
    }

    private Optional<OsUpdatePolicy> findEarliestCovering(Collection<OsUpdatePolicy> osUpdatePolicies,
                                                          OsUpdatePolicyTargetType targetType, Machine machine,
                                                          Set<String> machineTagIds) {
        return osUpdatePolicies.stream()
                .filter(osUpdatePolicy -> osUpdatePolicy.getTarget().getType() == targetType)
                .filter(osUpdatePolicy -> isCovering(osUpdatePolicy.getTarget(), machine, machineTagIds))
                .min(Comparator.comparing(OsUpdatePolicy::getCreatedAt));
    }

    private boolean isCovering(OsUpdatePolicyTarget target, Machine machine, Set<String> machineTagIds) {
        return switch (target.getType()) {
            case DEVICE -> target.getMachineIds().contains(machine.getMachineId());
            case DEVICE_TAG -> target.getTagIds().stream().anyMatch(machineTagIds::contains);
            case CUSTOMER -> target.getOrganizationId().equals(machine.getOrganizationId());
            case TENANT -> true;
        };
    }
}
