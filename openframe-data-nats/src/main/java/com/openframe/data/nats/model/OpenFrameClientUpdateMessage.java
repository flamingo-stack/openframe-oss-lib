package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class OpenFrameClientUpdateMessage implements DeliveryPayload {

    // absent on the legacy broadcast, present on a delivery to one machine
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private DeliveryRef delivery;
    private String version;
    private List<DownloadConfiguration> downloadConfigurations;

}
