package com.openframe.stream.handler;

import com.openframe.stream.config.ToolEventProperties;

final class ToolEventStores {

    private ToolEventStores() {
    }

    static ToolEventProperties of(ToolEventProperties.Store store) {
        ToolEventProperties properties = new ToolEventProperties();
        properties.setStore(store);
        return properties;
    }
}
