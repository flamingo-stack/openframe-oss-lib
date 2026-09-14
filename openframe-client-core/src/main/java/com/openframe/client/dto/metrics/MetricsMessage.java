package com.openframe.client.dto.metrics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricsMessage {
    private String machineId;
    private double cpu;
    private double memory;
    private Instant timestamp;
} 
