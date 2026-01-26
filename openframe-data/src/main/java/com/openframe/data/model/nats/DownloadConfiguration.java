package com.openframe.data.model.nats;

import lombok.Data;

@Data
public class DownloadConfiguration {

    private String os;
    private String fileName;
    private String agentFileName;
    private String link;
    private String executablePath;

}