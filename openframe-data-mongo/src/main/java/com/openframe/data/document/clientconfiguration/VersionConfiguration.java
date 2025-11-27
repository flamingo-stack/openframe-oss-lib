package com.openframe.data.document.clientconfiguration;

import lombok.Data;

@Data
public class VersionConfiguration {

    // One of the fields is used
    // If releaseVersion is true there should be
    private boolean releaseVersion;
    private String version;

}
