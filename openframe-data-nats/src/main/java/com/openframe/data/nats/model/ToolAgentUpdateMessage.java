package com.openframe.data.nats.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.data.document.toolagent.SessionType;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Data;

import java.util.List;

@Data
public class ToolAgentUpdateMessage implements DeliveryPayload {

    // absent on the legacy broadcast, present on a delivery to one machine
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private DeliveryRef delivery;
    private String toolAgentId;
    private String version;
    private SessionType sessionType;
    private List<DownloadConfiguration> downloadConfigurations;
    private List<AssetUpdate> assets;

    @Data
    public static class AssetUpdate {
        private String assetId;
        private String version;
        private boolean executable;
        private List<DownloadConfiguration> downloadConfigurations;
    }
}
