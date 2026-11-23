package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

public final class ToolOsSupport {

    private static final Map<OsType, String> DOWNLOAD_OS = Map.of(
            OsType.MAC_OS, "macos",
            OsType.WINDOWS, "windows"
    );
    private static final Pattern DOTTED_VERSION = Pattern.compile("\\d{1,9}(\\.\\d{1,9}){0,3}");
    private static final int COMPARED_PARTS = 4;

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

    public static boolean hasMinOsVersion(IntegratedToolAgent agent) {
        List<DownloadConfiguration> configurations = agent.getDownloadConfigurations();
        return configurations != null && configurations.stream()
                .map(DownloadConfiguration::getMinOsVersion)
                .anyMatch(ToolOsSupport::hasText);
    }

    public static boolean isUnsupported(Machine machine, IntegratedToolAgent agent) {
        return minOsVersion(agent, machine.getOsType())
                .map(minimum -> isBelow(machine.getOsVersion(), minimum))
                .orElse(false);
    }

    public static boolean isBelow(String osVersion, String minOsVersion) {
        Optional<int[]> version = parse(osVersion);
        Optional<int[]> minimum = parse(minOsVersion);
        return version.isPresent() && minimum.isPresent() && Arrays.compare(version.get(), minimum.get()) < 0;
    }

    private static Optional<int[]> parse(String version) {
        if (version == null || !DOTTED_VERSION.matcher(version.trim()).matches()) {
            return Optional.empty();
        }
        String[] parts = version.trim().split("\\.");
        int[] numbers = new int[COMPARED_PARTS];
        for (int i = 0; i < parts.length; i++) {
            numbers[i] = Integer.parseInt(parts[i]);
        }
        return Optional.of(numbers);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
