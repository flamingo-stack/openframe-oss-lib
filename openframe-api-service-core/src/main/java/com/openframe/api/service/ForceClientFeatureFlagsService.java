package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientFeatureFlagsRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientFeatureFlagsResponse;
import com.openframe.api.dto.force.response.ForceClientFeatureFlagsResponseItem;
import com.openframe.audit.AuditCapture;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_FEATURE_FLAGS_SET;
import static java.util.Objects.requireNonNullElse;
import static org.apache.commons.lang3.ObjectUtils.isEmpty;

// the current flags of the tenant, again, to the machines asked for: a machine that lost them or a support case
@Slf4j
@Service
@RequiredArgsConstructor
public class ForceClientFeatureFlagsService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryRouter deliveryRouter;
    private final AuditCapture auditCapture;

    public ForceClientFeatureFlagsResponse process(ForceClientFeatureFlagsRequest request) {
        List<String> machineIds = request.getMachineIds();
        validateMachineIds(machineIds);

        log.info("Process force client feature flags request for machines {}", machineIds);

        if (!isClientFeatureFlagsDeliveryEnabled()) {
            throw new IllegalStateException("Client feature flags are not delivered by the engine on this environment");
        }

        Map<String, ClientFeatureFlag> flags = currentFlags();
        List<ForceClientFeatureFlagsResponseItem> responseItems = machineIds.stream()
                .map(machineId -> processMachine(machineId, flags))
                .toList();

        ForceClientFeatureFlagsResponse response = new ForceClientFeatureFlagsResponse();
        response.setItems(responseItems);
        return response;
    }

    private ForceClientFeatureFlagsResponseItem processMachine(String machineId, Map<String, ClientFeatureFlag> flags) {
        try {
            auditCapture.run(DEVICE_FEATURE_FLAGS_SET, machineId, Map.of("flags", flags), () -> send(machineId, flags));
            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (RuntimeException e) {
            log.error("Failed to send the client feature flags to machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private void send(String machineId, Map<String, ClientFeatureFlag> flags) {
        if (!deliveryRouter.dispatch(ClientFeatureFlagsDeliverySeed.forMachine(machineId, flags))) {
            throw new InternalException("Client feature flags not carried for machine " + machineId);
        }
    }

    private Map<String, ClientFeatureFlag> currentFlags() {
        OpenFrameClientConfiguration configuration = clientConfigurationService.get();
        return requireNonNullElse(configuration.getFeatureFlags(), Map.of());
    }

    private boolean isClientFeatureFlagsDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS);
    }

    private void validateMachineIds(List<String> machineIds) {
        if (isEmpty(machineIds)) {
            throw new IllegalArgumentException("No machine ids provided");
        }
    }

    private ForceClientFeatureFlagsResponseItem buildResponseItem(String machineId, ForceAgentStatus status) {
        ForceClientFeatureFlagsResponseItem responseItem = new ForceClientFeatureFlagsResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setStatus(status);
        return responseItem;
    }
}
