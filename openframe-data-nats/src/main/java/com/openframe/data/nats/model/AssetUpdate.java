package com.openframe.data.nats.model;

import lombok.Data;

import java.util.List;

@Data
public class AssetUpdate {

    private String assetId;
    private String version;
    private boolean executable;
    private List<DownloadConfiguration> downloadConfigurations;

}
