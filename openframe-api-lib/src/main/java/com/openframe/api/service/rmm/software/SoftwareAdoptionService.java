package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAdoptionResponse;
import com.openframe.api.dto.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliveryFailureReader;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareAdoptionService {

    private final PackageUpdateRequestRepository packageUpdateRequestRepository;
    private final PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    private final PackageAdoptDeliveryFailureReader packageAdoptDeliveryFailureReader;
    private final TenantIdProvider tenantIdProvider;

    // the latest adoption of the title on each device; a device whose latest adoption completed has none
    public Map<String, SoftwareAdoptionResponse> getAdoptionsByMachineId(String softwareId, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return Map.of();
        }
        String tenantId = tenantIdProvider.getTenantId();
        Map<String, PackageUpdateRequest> requests = packageUpdateRequestRepository
                .findByTenantIdAndActionAndSoftwareIdAndMachineIdsIn(tenantId, SoftwareAction.ADOPT, softwareId, machineIds)
                .stream()
                .collect(Collectors.toMap(PackageUpdateRequest::getRequestId, Function.identity()));
        if (requests.isEmpty()) {
            return Map.of();
        }
        Set<String> requestIds = requests.keySet();
        Set<String> pageMachineIds = Set.copyOf(machineIds);
        BinaryOperator<PackageUpdateDeviceState> later = BinaryOperator.maxBy(
                Comparator.comparing(PackageUpdateDeviceState::getCreatedAt));
        Map<String, PackageUpdateDeviceState> latest = packageUpdateDeviceStateRepository
                .findByTenantIdAndRequestIdIn(tenantId, requestIds).stream()
                .filter(state -> pageMachineIds.contains(state.getMachineId()))
                .collect(Collectors.toMap(PackageUpdateDeviceState::getMachineId, Function.identity(), later));
        Collection<PackageUpdateDeviceState> states = latest.values();
        Map<String, String> engineFailures = packageAdoptDeliveryFailureReader.getFailedMessagesByStateId(states);

        Map<String, SoftwareAdoptionResponse> adoptions = new HashMap<>();
        for (PackageUpdateDeviceState state : states) {
            PackageUpdateRequest request = requests.get(state.getRequestId());
            SoftwareAdoptionResponse adoption = adoptionOf(state, request, engineFailures);
            if (adoption != null) {
                adoptions.put(state.getMachineId(), adoption);
            }
        }
        return adoptions;
    }

    private static SoftwareAdoptionResponse adoptionOf(PackageUpdateDeviceState state, PackageUpdateRequest request,
                                                       Map<String, String> engineFailures) {
        SoftwareActionStatus status = state.getStatus();
        if (status == SoftwareActionStatus.COMPLETED) {
            return null;
        }
        if (status == SoftwareActionStatus.FAILED) {
            return failed(request, state.getFailedMessage());
        }
        String engineFailure = engineFailures.get(state.getId());
        if (engineFailure != null) {
            return failed(request, engineFailure);
        }
        return SoftwareAdoptionResponse.builder()
                .status(SoftwareAdoptionStatus.ADOPTING)
                .packageManager(request.getPackageManager())
                .build();
    }

    private static SoftwareAdoptionResponse failed(PackageUpdateRequest request, String error) {
        return SoftwareAdoptionResponse.builder()
                .status(SoftwareAdoptionStatus.FAILED)
                .packageManager(request.getPackageManager())
                .error(error)
                .build();
    }
}
