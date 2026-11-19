package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.ClientVersionKey;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class ToolOsSupport {

    private static final Map<OsType, String> DOWNLOAD_OS = Map.of(
            OsType.MAC_OS, "macos",
            OsType.WINDOWS, "windows"
    );

    private ToolOsSupport() {
    }

    public static Optional<String> downloadOs(OsType osType) {
        return Optional.ofNullable(osType).map(DOWNLOAD_OS::get);
    }

    public static Optional<String> minOsVersion(IntegratedToolAgent agent, OsType osType) {
        List<DownloadConfiguration> configurations = agent.getDownloadConfigurations();
        if (configurations == null) {
            return Optional.empty();
        }
        return downloadOs(osType).flatMap(os -> configurations.stream()
                .filter(configuration -> os.equalsIgnoreCase(configuration.getOs()))
                .map(DownloadConfiguration::getMinOsVersion)
                .filter(ToolOsSupport::hasText)
                .findFirst());
    }

    public static boolean isUnsupported(Machine machine, IntegratedToolAgent agent) {
        return minOsVersion(agent, machine.getOsType())
                .map(minimum -> isBelow(machine.getOsVersion(), minimum))
                .orElse(false);
    }

    public static boolean isBelow(String osVersion, String minOsVersion) {
        Long version = ClientVersionKey.parse(osVersion);
        Long minimum = ClientVersionKey.parse(minOsVersion);
        return version != null && minimum != null && version < minimum;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
