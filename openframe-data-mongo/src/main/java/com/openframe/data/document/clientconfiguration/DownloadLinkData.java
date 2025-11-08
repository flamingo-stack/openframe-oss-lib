package com.openframe.data.document.clientconfiguration;

import lombok.Data;

@Data
public class DownloadLinkData {

    private String os;
    private String linkTemplate;
    private String fileName;
    private String agentFileName;

}
