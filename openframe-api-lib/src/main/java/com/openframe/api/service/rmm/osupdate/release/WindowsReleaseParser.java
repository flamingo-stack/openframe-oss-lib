package com.openframe.api.service.rmm.osupdate.release;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// endoflife.date Windows releases, JSON list.
@Component
@ConditionalOnProperty(name = {"openframe.rmm.os-update.enabled", "openframe.rmm.os-update.os-versions.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
public class WindowsReleaseParser {

    // WARNING: latest is the base build (10.0.26100) without the monthly revision, so only an older base build is behind
    private static final String BUILD_PREFIX = "10.0.";

    private final ObjectMapper objectMapper;

    // A list that is no list is broken, not empty: it must not answer "no release known".
    public List<WindowsRelease> parse(InputStream windowsReleases) {
        JsonNode releases = objectMapper.readTree(windowsReleases);
        if (!releases.isArray()) {
            throw new IllegalArgumentException("endoflife.date Windows answer is no list");
        }
        List<WindowsRelease> parsedReleases = new ArrayList<>();
        for (JsonNode release : releases) {
            String cycle = release.path("cycle").asString("");
            if (!cycle.isBlank()) {
                parsedReleases.add(WindowsRelease.builder()
                        .cycle(cycle)
                        .releaseLabel(release.path("releaseLabel").asString(null))
                        .latestBuild(toBuild(release.path("latest").asString(null)))
                        .endOfSupportAt(toDate(release.path("eol")))
                        .build());
            }
        }
        return parsedReleases;
    }

    private static String toBuild(String latest) {
        if (latest == null || !latest.startsWith(BUILD_PREFIX)) {
            return latest;
        }
        return latest.substring(BUILD_PREFIX.length());
    }

    // eol may be a boolean instead of a date: no date then.
    private static LocalDate toDate(JsonNode eol) {
        return eol.isString() ? LocalDate.parse(eol.asString()) : null;
    }
}
