package com.openframe.api.service.rmm.software.matching;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class SoftwarePackageMatcher {

    // the osquery table Fleet took a row from, and the package manager that can match such a row
    private static final Map<String, PackageManagerType> MANAGER_BY_FLEET_SOURCE =
            Map.of("programs", PackageManagerType.WINGET);

    private final Map<PackageManagerType, PackageMatcher> matchers;

    // no matcher bean yet for any manager: every row is left out and keeps its current status
    public SoftwarePackageMatcher(ObjectProvider<PackageMatcher> matchers) {
        this.matchers = matchers.orderedStream().collect(toMap(PackageMatcher::getManager, Function.identity()));
    }

    // keyed by identity: two rows can be equal; a row no matcher takes is left out
    public Map<SoftwareResponse, PackageMatch> match(List<SoftwareResponse> rows) {
        Map<PackageMatcher, List<SoftwareResponse>> rowsByMatcher = new LinkedHashMap<>();
        rows.forEach(row -> matcherOf(row).ifPresent(matcher -> addRow(rowsByMatcher, matcher, row)));
        Map<SoftwareResponse, PackageMatch> matches = new IdentityHashMap<>();
        rowsByMatcher.forEach((matcher, group) -> putMatches(matches, group, matcher));
        return matches;
    }

    private Optional<PackageMatcher> matcherOf(SoftwareResponse row) {
        return Optional.ofNullable(row.getFleetSource())
                .map(MANAGER_BY_FLEET_SOURCE::get)
                .map(matchers::get);
    }

    private static void addRow(Map<PackageMatcher, List<SoftwareResponse>> rowsByMatcher, PackageMatcher matcher,
                               SoftwareResponse row) {
        List<SoftwareResponse> group = rowsByMatcher.computeIfAbsent(matcher, key -> new ArrayList<>());
        group.add(row);
    }

    private static void putMatches(Map<SoftwareResponse, PackageMatch> matches, List<SoftwareResponse> group,
                                   PackageMatcher matcher) {
        List<PackageMatch> results = matcher.match(group);
        for (int i = 0; i < group.size(); i++) {
            matches.put(group.get(i), results.get(i));
        }
    }
}
