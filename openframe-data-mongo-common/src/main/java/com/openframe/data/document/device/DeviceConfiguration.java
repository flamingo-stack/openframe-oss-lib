package com.openframe.data.document.device;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class DeviceConfiguration {
    private Map<String, String> settings;
    private List<String> installedSoftware;
    private Map<String, String> networkConfig;
    private SecuritySettings security;
}
