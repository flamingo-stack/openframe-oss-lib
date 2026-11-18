package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageAdoptDeliveryFailureReader;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptEngineFailureSweep {

    private final TenantIdProvider tenantIdProvider;
    private final PackageUpdateRequestRepository packageUpdateRequestRepository;
    private final PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    private final PackageAdoptDeliveryFailureReader packageAdoptDeliveryFailureReader;
    private final PackageAdoptStatusProcessor packageAdoptStatusProcessor;

    @Value("${openframe.rmm.software.adopt.failure-sweep.batch-size:100}")
    private int batchSize;

    public void sweep() {
        String tenantId = tenantIdProvider.getTenantId();
        Limit limit = Limit.of(batchSize);
        List<PackageUpdateRequest> page = packageUpdateRequestRepository.findByTenantIdAndActionAndStatusOrderByIdAsc(
                tenantId, SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, limit);
        sweepPage(tenantId, page);
        while (page.size() == batchSize) {
            String afterId = page.getLast().getId();
            page = packageUpdateRequestRepository.findByTenantIdAndActionAndStatusAndIdGreaterThanOrderByIdAsc(
                    tenantId, SoftwareAction.ADOPT, SoftwareActionStatus.IN_PROGRESS, afterId, limit);
            sweepPage(tenantId, page);
        }
    }

    private void sweepPage(String tenantId, List<PackageUpdateRequest> page) {
        if (page.isEmpty()) {
            return;
        }
        Map<String, PackageUpdateRequest> requests = page.stream()
                .collect(Collectors.toMap(PackageUpdateRequest::getRequestId, Function.identity()));
        Set<String> requestIds = requests.keySet();
        List<PackageUpdateDeviceState> states = packageUpdateDeviceStateRepository
                .findByTenantIdAndRequestIdIn(tenantId, requestIds);
        Map<String, String> engineFailures = packageAdoptDeliveryFailureReader.getFailedMessagesByStateId(states);
        for (PackageUpdateDeviceState state : states) {
            String error = engineFailures.get(state.getId());
            if (error != null) {
                PackageUpdateRequest request = requests.get(state.getRequestId());
                packageAdoptStatusProcessor.failByEngine(request, state.getMachineId(), error);
            }
        }
        rollUpSettled(requests, states);
    }

    // two devices finishing at once can leave a settled request in progress for good
    private void rollUpSettled(Map<String, PackageUpdateRequest> requests, List<PackageUpdateDeviceState> states) {
        Set<String> adopting = states.stream()
                .filter(state -> state.getStatus() == SoftwareActionStatus.IN_PROGRESS)
                .map(PackageUpdateDeviceState::getRequestId)
                .collect(Collectors.toSet());
        requests.values().stream()
                .filter(request -> !adopting.contains(request.getRequestId()))
                .forEach(packageAdoptStatusProcessor::rollUp);
    }
}
