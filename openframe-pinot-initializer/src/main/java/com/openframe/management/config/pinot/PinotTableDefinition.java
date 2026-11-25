package com.openframe.management.config.pinot;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PinotTableDefinition {
    private final String name;
    private final String schemaFile;
    private final String realtimeTableConfigFile;
}
