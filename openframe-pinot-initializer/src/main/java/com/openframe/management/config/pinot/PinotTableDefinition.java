package com.openframe.management.config.pinot;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PinotTableDefinition {
    private final String name;
    private final String schemaFile;
    private final String realtimeTableConfigFile;
    private final String offlineTableConfigFile;

    public PinotTableDefinition(String name, String schemaFile, String realtimeTableConfigFile) {
        this(name, schemaFile, realtimeTableConfigFile, null);
    }

    public boolean hasOfflineTable() {
        return offlineTableConfigFile != null;
    }
}
