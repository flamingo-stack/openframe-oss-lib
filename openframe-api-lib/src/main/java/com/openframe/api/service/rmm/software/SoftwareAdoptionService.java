package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareAdoptionResponse;
import com.openframe.api.dto.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BinaryOperator;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareAdoptionService {

    // the api hands the order to Kafka and the client service records its delivery row a moment later
    static final Duration DELIVERY_ROW_GRACE = Duration.ofMinutes(2);
    static final String NOT_DELIVERED_ERROR = "NOT_DELIVERED: the order has no delivery record";

    private final PackageUpdateRequestRepository packageUpdateRequestRepository;
    private final PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    private final MachineDeliveryRepository machineDeliveryRepository;
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
        Map<String, MachineDelivery> deliveries = deliveriesOf(states);
        Instant graceStart = Instant.now().minus(DELIVERY_ROW_GRACE);

        Map<String, SoftwareAdoptionResponse> adoptions = new HashMap<>();
        for (PackageUpdateDeviceState state : states) {
            PackageUpdateRequest request = requests.get(state.getRequestId());
            SoftwareAdoptionResponse adoption = adoptionOf(state, request, deliveries, graceStart);
            if (adoption != null) {
                adoptions.put(state.getMachineId(), adoption);
            }
        }
        return adoptions;
    }

    private Map<String, MachineDelivery> deliveriesOf(Collection<PackageUpdateDeviceState> states) {
        List<String> ids = states.stream()
                .filter(state -> state.getStatus() == SoftwareActionStatus.IN_PROGRESS)
                .map(SoftwareAdoptionService::deliveryId)
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return machineDeliveryRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(MachineDelivery::getId, Function.identity()));
    }

    private static SoftwareAdoptionResponse adoptionOf(PackageUpdateDeviceState state, PackageUpdateRequest request,
                                                       Map<String, MachineDelivery> deliveries, Instant graceStart) {
        SoftwareActionStatus status = state.getStatus();
        if (status == SoftwareActionStatus.COMPLETED) {
            return null;
        }
        if (status == SoftwareActionStatus.FAILED) {
            return failed(request, state.getFailedMessage());
        }
        String id = deliveryId(state);
        MachineDelivery delivery = deliveries.get(id);
        if (delivery == null && state.getCreatedAt().isBefore(graceStart)) {
            return failed(request, NOT_DELIVERED_ERROR);
        }
        if (delivery != null && delivery.getStatus() == DeliveryStatus.FAILED) {
            String error = engineError(delivery);
            return failed(request, error);
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

    private static String engineError(MachineDelivery delivery) {
        DeliveryFailure failure = delivery.getFailure();
        String reason = failure == null ? DeliveryStatus.FAILED.name() : failure.name();
        String error = delivery.getError();
        return hasText(error) ? reason + ": " + error : reason;
    }

    private static String deliveryId(PackageUpdateDeviceState state) {
        return DeliveryId.of(DeliveryType.PACKAGE_ADOPT, state.getRequestId(), state.getMachineId());
    }
}
