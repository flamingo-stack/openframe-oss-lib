package com.openframe.document.device;

import lombok.Data;

import java.util.List;

@Data
public class DeviceHealth {
    private double cpuUsage;
    private double memoryUsage;
    private double diskUsage;
    private List<String> activeProcesses;
    private List<Alert> alerts;
}
