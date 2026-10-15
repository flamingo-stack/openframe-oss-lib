package com.openframe.data.nats.model;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Data;

import java.util.Map;

// the whole set of switches, every time: the agent replaces what it holds, it never merges
@Data
public class ClientFeatureFlagsMessage implements DeliveryPayload {

    private DeliveryRef delivery;
    private Map<String, ClientFeatureFlag> flags;
}
