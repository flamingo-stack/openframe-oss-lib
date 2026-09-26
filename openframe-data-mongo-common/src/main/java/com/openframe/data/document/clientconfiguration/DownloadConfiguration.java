package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DownloadConfiguration {

    private String os;
    private String linkTemplate;
    private String fileName;
    private String targetFileName;
    private InstallationType installationType = InstallationType.STANDARD;
    private String bundleId;
    private String serviceName;

}
