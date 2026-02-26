package com.openframe.data.nats.model;

import com.openframe.data.document.toolagent.SessionType;
import lombok.Data;

import java.util.List;

@Data
public class ToolAgentUpdateMessage {

    private String toolAgentId;
    private String version;
    private SessionType sessionType;
    private List<DownloadConfiguration> downloadConfigurations;

}
