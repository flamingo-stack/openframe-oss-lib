package com.openframe.api.service.rmm.osupdate.release;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class WindowsReleaseMatcher {

    // WARNING: endoflife has a row per edition group of a Windows release, each with its own end date; a release
    // with one end date for every edition (Windows 10 22H2) has one row without a suffix
    private static final Map<WindowsEditionGroup, String> CYCLE_SUFFIXES = Map.of(
            WindowsEditionGroup.HOME_AND_PRO, "-w",
            WindowsEditionGroup.ENTERPRISE_AND_EDUCATION, "-e",
            WindowsEditionGroup.ENTERPRISE_LTSC, "-e-lts",
            WindowsEditionGroup.IOT_ENTERPRISE_LTSC, "-iot-lts");

    // osVersion as the agent reports it: "11 24H2", "10 22H2". The row of the edition group, else the row
    // without a suffix. Null = neither: the row of another edition group is never taken.
    public WindowsRelease findWindowsRelease(List<WindowsRelease> windowsReleases, String osVersion,
                                             WindowsEditionGroup windowsEditionGroup) {
        if (osVersion == null || windowsReleases.isEmpty()) {
            return null;
        }
        String cycle = String.join("-", osVersion.trim().toLowerCase(Locale.ROOT).split("\\s+"));
        Map<String, WindowsRelease> windowsReleasesByCycle = windowsReleases.stream()
                .collect(Collectors.toMap(WindowsRelease::getCycle, Function.identity(), (first, second) -> first));
        WindowsRelease editionGroupWindowsRelease =
                windowsReleasesByCycle.get(cycle + CYCLE_SUFFIXES.get(windowsEditionGroup));
        return editionGroupWindowsRelease != null ? editionGroupWindowsRelease : windowsReleasesByCycle.get(cycle);
    }
}
