package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.exception.OsUpdatePolicyNotFoundException;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.audit.Audited;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import com.openframe.data.service.rmm.osupdate.OsUpdatePolicyResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.data.document.audit.AuditAction.OS_UPDATE_POLICY_CREATE;
import static com.openframe.data.document.audit.AuditAction.OS_UPDATE_POLICY_DELETE;
import static com.openframe.data.document.audit.AuditAction.OS_UPDATE_POLICY_UPDATE;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdatePolicyService {

    private final TenantIdProvider tenantIdProvider;
    private final OsUpdatePolicyRepository osUpdatePolicyRepository;
    private final OsUpdatePolicyValidator osUpdatePolicyValidator;
    private final OsUpdatePolicyResponseMapper osUpdatePolicyResponseMapper;
    private final OsUpdatePolicyResolver osUpdatePolicyResolver;
    private final DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;
    private final DeviceService deviceService;
    private final MachineRepository machineRepository;
    private final TagAssignmentRepository tagAssignmentRepository;

    public List<OsUpdatePolicyResponse> listPolicies() {
        return findPolicies().stream().map(osUpdatePolicyResponseMapper::toResponse).toList();
    }

    public OsUpdatePolicyResponse getPolicy(String id) {
        return osUpdatePolicyResponseMapper.toResponse(requirePolicy(id));
    }

    // Null = no policy covers the device, or the policies are not applied to it: a Mac, a device that does not
    // report its OS, a device we cannot manage.
    public OsUpdatePolicyResponse findPolicyOfDevice(String machineId) {
        deviceService.verifyExists(machineId);
        if (!deviceOsUpdateRolloutStateService.isRolloutDevice(machineId)) {
            return null;
        }
        Set<String> machineTagIds = tagAssignmentRepository
                .findByEntityIdAndEntityType(machineId, TagEntityType.DEVICE).stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        return machineRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId)
                .map(machine -> osUpdatePolicyResolver.resolve(findPolicies(), machine, machineTagIds))
                .map(osUpdatePolicyResponseMapper::toResponse)
                .orElse(null);
    }

    @Audited(action = OS_UPDATE_POLICY_CREATE, targetId = "#result.id", targetName = "#osUpdatePolicyCommand.name")
    public OsUpdatePolicyResponse createPolicy(OsUpdatePolicyCommand osUpdatePolicyCommand) {
        osUpdatePolicyValidator.validate(osUpdatePolicyCommand, findPolicies());
        Instant now = Instant.now();
        OsUpdatePolicy osUpdatePolicy = OsUpdatePolicy.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .createdAt(now)
                .build();
        return save(osUpdatePolicy, osUpdatePolicyCommand, now);
    }

    // Replaces the policy as a whole.
    @Audited(action = OS_UPDATE_POLICY_UPDATE, targetId = "#id")
    public OsUpdatePolicyResponse updatePolicy(String id, OsUpdatePolicyCommand osUpdatePolicyCommand) {
        OsUpdatePolicy osUpdatePolicy = requirePolicy(id);
        List<OsUpdatePolicy> otherOsUpdatePolicies = findPolicies().stream()
                .filter(other -> !other.getId().equals(id))
                .toList();
        osUpdatePolicyValidator.validate(osUpdatePolicyCommand, otherOsUpdatePolicies);
        return save(osUpdatePolicy, osUpdatePolicyCommand, Instant.now());
    }

    @Audited(action = OS_UPDATE_POLICY_DELETE, targetId = "#id")
    public void deletePolicy(String id) {
        osUpdatePolicyRepository.delete(requirePolicy(id));
    }

    // Saves only: the scheduled run in management is the one that applies a policy to the devices.
    private OsUpdatePolicyResponse save(OsUpdatePolicy osUpdatePolicy, OsUpdatePolicyCommand osUpdatePolicyCommand,
                                        Instant now) {
        osUpdatePolicy.setName(osUpdatePolicyCommand.getName());
        osUpdatePolicy.setTarget(osUpdatePolicyCommand.getTarget());
        osUpdatePolicy.setRolloutRules(osUpdatePolicyCommand.getRolloutRules());
        osUpdatePolicy.setRestartDeadlines(osUpdatePolicyCommand.getRestartDeadlines());
        osUpdatePolicy.setPilotTagId(osUpdatePolicyCommand.getPilotTagId());
        osUpdatePolicy.setMaintenanceWindows(osUpdatePolicyCommand.getMaintenanceWindows());
        osUpdatePolicy.setOfflineRule(osUpdatePolicyCommand.getOfflineRule());
        osUpdatePolicy.setInUseRule(osUpdatePolicyCommand.getInUseRule());
        osUpdatePolicy.setDomainControllerRestartManual(osUpdatePolicyCommand.isDomainControllerRestartManual());
        osUpdatePolicy.setRestartModes(osUpdatePolicyCommand.getRestartModes());
        osUpdatePolicy.setRestartDialog(osUpdatePolicyCommand.getRestartDialog());
        osUpdatePolicy.setUpdatedAt(now);
        return osUpdatePolicyResponseMapper.toResponse(osUpdatePolicyRepository.save(osUpdatePolicy));
    }

    private List<OsUpdatePolicy> findPolicies() {
        return osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(tenantIdProvider.getTenantId());
    }

    private OsUpdatePolicy requirePolicy(String id) {
        return osUpdatePolicyRepository.findByTenantIdAndId(tenantIdProvider.getTenantId(), id)
                .orElseThrow(() -> new OsUpdatePolicyNotFoundException("OS update policy not found: " + id));
    }
}
