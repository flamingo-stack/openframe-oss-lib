package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptDeliveryFailureReader {

    // the api hands the order to Kafka and the client service records its delivery row a moment later
    public static final Duration DELIVERY_ROW_GRACE = Duration.ofMinutes(2);
    public static final String NOT_DELIVERED_ERROR = "NOT_DELIVERED: the order has no delivery record";

    private final MachineDeliveryRepository machineDeliveryRepository;

    // the error per device state id of the in-progress adoptions the engine failed or never recorded
    public Map<String, String> getFailedMessagesByStateId(Collection<PackageUpdateDeviceState> states) {
        List<PackageUpdateDeviceState> inProgress = states.stream()
                .filter(state -> state.getStatus() == SoftwareActionStatus.IN_PROGRESS)
                .toList();
        if (inProgress.isEmpty()) {
            return Map.of();
        }
        List<String> ids = inProgress.stream()
                .map(PackageAdoptDeliveryFailureReader::deliveryId)
                .toList();
        Map<String, MachineDelivery> deliveries = machineDeliveryRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(MachineDelivery::getId, Function.identity()));
        Instant graceStart = Instant.now().minus(DELIVERY_ROW_GRACE);

        Map<String, String> failedMessages = new HashMap<>();
        for (PackageUpdateDeviceState state : inProgress) {
            String id = deliveryId(state);
            MachineDelivery delivery = deliveries.get(id);
            String error = failedMessageOf(state, delivery, graceStart);
            if (error != null) {
                failedMessages.put(state.getId(), error);
            }
        }
        return failedMessages;
    }

    private static String failedMessageOf(PackageUpdateDeviceState state, MachineDelivery delivery,
                                          Instant graceStart) {
        if (delivery == null) {
            return state.getCreatedAt().isBefore(graceStart) ? NOT_DELIVERED_ERROR : null;
        }
        if (delivery.getStatus() != DeliveryStatus.FAILED) {
            return null;
        }
        DeliveryFailure failure = delivery.getFailure();
        String reason = failure == null ? DeliveryStatus.FAILED.name() : failure.name();
        String error = delivery.getError();
        return hasText(error) ? reason + ": " + error : reason;
    }

    private static String deliveryId(PackageUpdateDeviceState state) {
        return DeliveryId.of(DeliveryType.PACKAGE_ADOPT, state.getRequestId(), state.getMachineId());
    }
}
