package com.openframe.data.model.nats;

import lombok.Data;

@Data
public class DownloadConfiguration {

    private String os;
    private String linkTemplate;
    private String fileName;
    private String agentFileName;

}