package com.openframe.data.nats.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenFrameClientUpdateMessage {

    private String version;
    private List<DownloadConfiguration> downloadConfigurations;

}
