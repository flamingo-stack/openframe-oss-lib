package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.partitioningBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Service
public class SoftwarePackageMatcher {

    private final Map<FleetSource, PackageMatcher> matchers;
    private final Map<FleetSource, PackageMatcher> adoptionMatchers;
    private final PackageCatalogRepository catalogRepository;

    // no matcher bean for an osquery table: its programs are left out and keep their status
    public SoftwarePackageMatcher(ObjectProvider<PackageMatcher> matchers, PackageCatalogRepository catalogRepository) {
        Map<Boolean, Map<FleetSource, PackageMatcher>> byPurpose = matchers.orderedStream().collect(
                partitioningBy(PackageMatcher::isForAdoption, toMap(PackageMatcher::getFleetSource, Function.identity())));
        this.matchers = byPurpose.get(false);
        this.adoptionMatchers = byPurpose.get(true);
        this.catalogRepository = catalogRepository;
    }

    // keyed by identity: two programs can be equal; a program no matcher takes is left out
    public Map<InstalledProgram, PackageMatch> match(List<InstalledProgram> programs) {
        return match(programs, matchers, InstalledProgram::getStoredMatch);
    }

    // the package a program can be adopted into, whatever match() says about it: which of the two counts is decided
    // per device, by the managers that run there
    public Map<InstalledProgram, PackageMatch> matchForAdoption(List<InstalledProgram> programs) {
        return match(programs, adoptionMatchers, InstalledProgram::getStoredAdoptionMatch);
    }

    private Map<InstalledProgram, PackageMatch> match(List<InstalledProgram> programs,
                                                      Map<FleetSource, PackageMatcher> matchersBySource,
                                                      Function<InstalledProgram, SoftwarePackageMatch> storedOf) {
        Map<InstalledProgram, PackageMatch> matches = new IdentityHashMap<>();
        List<InstalledProgram> unresolved = resolveStored(programs, storedOf, matches);
        Map<PackageMatcher, List<InstalledProgram>> byMatcher = new LinkedHashMap<>();
        unresolved.forEach(program -> matcherOf(program, matchersBySource)
                .ifPresent(matcher -> byMatcher.computeIfAbsent(matcher, key -> new ArrayList<>()).add(program)));
        byMatcher.forEach((matcher, group) -> putMatches(matches, group, matcher));
        return matches;
    }

    // a stored match is the answer unless its package left the catalog: that program is matched afresh
    private List<InstalledProgram> resolveStored(List<InstalledProgram> programs,
                                                 Function<InstalledProgram, SoftwarePackageMatch> storedOf,
                                                 Map<InstalledProgram, PackageMatch> matches) {
        Map<PackageManagerType, Map<String, PackageCatalogEntry>> storedEntries = storedEntries(programs, storedOf);
        List<InstalledProgram> unresolved = new ArrayList<>();
        for (InstalledProgram program : programs) {
            SoftwarePackageMatch stored = storedOf.apply(program);
            PackageMatch resolved = resolve(stored, storedEntries);
            if (resolved == null) {
                unresolved.add(program);
            } else {
                matches.put(program, resolved);
            }
        }
        return unresolved;
    }

    private Map<PackageManagerType, Map<String, PackageCatalogEntry>> storedEntries(
            List<InstalledProgram> programs, Function<InstalledProgram, SoftwarePackageMatch> storedOf) {
        Map<PackageManagerType, Set<String>> idsByManager = programs.stream()
                .map(storedOf)
                .filter(SoftwarePackageMatcher::isStoredPackage)
                .collect(groupingBy(SoftwarePackageMatch::getManager, mapping(SoftwarePackageMatch::getPackageId, toSet())));
        Map<PackageManagerType, Map<String, PackageCatalogEntry>> entries = new LinkedHashMap<>();
        idsByManager.forEach((manager, ids) -> entries.put(manager,
                catalogRepository.findByManagerAndPackageIdIn(manager, ids).stream()
                        .collect(toMap(PackageCatalogEntry::getPackageId, Function.identity(), (first, second) -> first))));
        return entries;
    }

    private static boolean isStoredPackage(SoftwarePackageMatch stored) {
        return stored != null && stored.getState() == PackageMatchState.MATCHED
                && stored.getManager() != null && stored.getPackageId() != null;
    }

    private static PackageMatch resolve(SoftwarePackageMatch stored,
                                        Map<PackageManagerType, Map<String, PackageCatalogEntry>> entries) {
        if (stored == null || stored.getState() == null) {
            return null;
        }
        return switch (stored.getState()) {
            case NO_PACKAGE -> PackageMatch.noPackage();
            case AMBIGUOUS -> PackageMatch.ambiguous();
            case MATCHED -> Optional.ofNullable(entries.get(stored.getManager()))
                    .map(byId -> byId.get(stored.getPackageId()))
                    .map(PackageMatch::of)
                    .orElse(null);
        };
    }

    private static Optional<PackageMatcher> matcherOf(InstalledProgram program,
                                                      Map<FleetSource, PackageMatcher> matchersBySource) {
        return Optional.ofNullable(program.getFleetSource())
                .map(matchersBySource::get);
    }

    private static void putMatches(Map<InstalledProgram, PackageMatch> matches, List<InstalledProgram> group,
                                   PackageMatcher matcher) {
        List<PackageMatch> results = matcher.match(group);
        for (int i = 0; i < group.size(); i++) {
            matches.put(group.get(i), Objects.requireNonNull(results.get(i)));
        }
    }
}
