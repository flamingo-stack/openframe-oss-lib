package com.openframe.management.config.pinot;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class PinotConfig {
    private String name;
    private String schemaFile;
    private String tableRealtimeConfigFile;
    private String tableOfflineConfigFile;
}
