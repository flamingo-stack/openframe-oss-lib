package com.openframe.data.document.clientconfiguration;

import lombok.Data;

@Data
public class DownloadConfiguration {

    private String os;
    private String linkTemplate;
    private String fileName;
    private String targetFileName;
    private InstallationType installationType = InstallationType.STANDARD;
    private String bundleId;

}
