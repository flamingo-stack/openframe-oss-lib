package com.openframe.data.nats.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class OpenFrameClientUpdateMessage {

    private String version;
    private List<DownloadConfiguration> downloadConfigurations;

}
