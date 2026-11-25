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

    // WARNING: endoflife splits a Windows 11 release into -w (Home/Pro) and -e (Enterprise/Education) rows with
    // different end dates, Windows 10 22H2 has one row without a suffix; a version row shows -w
    private static final String HOME_AND_PRO_SUFFIX = "-w";

    // osVersion as the agent reports it: "11 24H2", "10 22H2". Null = no row for the version.
    public WindowsRelease findWindowsRelease(List<WindowsRelease> windowsReleases, String osVersion) {
        if (osVersion == null || windowsReleases.isEmpty()) {
            return null;
        }
        String cycle = String.join("-", osVersion.trim().toLowerCase(Locale.ROOT).split("\\s+"));
        Map<String, WindowsRelease> windowsReleasesByCycle = windowsReleases.stream()
                .collect(Collectors.toMap(WindowsRelease::getCycle, Function.identity(), (first, second) -> first));
        WindowsRelease homeAndProWindowsRelease = windowsReleasesByCycle.get(cycle + HOME_AND_PRO_SUFFIX);
        return homeAndProWindowsRelease != null ? homeAndProWindowsRelease : windowsReleasesByCycle.get(cycle);
    }
}
