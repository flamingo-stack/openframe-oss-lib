package com.openframe.data.document.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceConfiguration {
    private Map<String, String> settings;
    private List<String> installedSoftware;
    private Map<String, String> networkConfig;
    private SecuritySettings security;
}

