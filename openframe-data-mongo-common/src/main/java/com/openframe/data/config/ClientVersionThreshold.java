package com.openframe.data.config;

import com.openframe.data.document.device.ClientVersionKey;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// An unknown client version (null key) is never outdated, so a device without a reported version raises no banner
@Component
public class ClientVersionThreshold {

    @Getter
    private final long minSupportedKey;

    public ClientVersionThreshold(
            @Value("${openframe.devices.client.min-supported-version:1.6.0}") String minSupportedVersion) {
        Long key = ClientVersionKey.parse(minSupportedVersion);
        if (key == null) {
            throw new IllegalStateException(
                    "openframe.devices.client.min-supported-version is not a version: " + minSupportedVersion);
        }
        this.minSupportedKey = key;
    }

    public boolean isOutdated(Long agentVersionKey) {
        return agentVersionKey != null && agentVersionKey < minSupportedKey;
    }
}
