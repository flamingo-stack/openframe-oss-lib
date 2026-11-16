package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.rmm.software.FleetSource;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toSet;

// an app brew did not install has no token: its bundle id decides, its name alone only when no cask knows the id
@Component
@RequiredArgsConstructor
public class BrewAppMatcher implements PackageMatcher {

    private static final String APPLE_BUNDLE_ID_PREFIX = "com.apple.";
    private static final String APP_SUFFIX = ".app";
    private static final String VARIANT_SEPARATOR = "@";
    private static final String TOKEN_SEPARATOR = "-";

    private final BrewCaskIndexCache brewCaskIndexCache;

    @Override
    public FleetSource getFleetSource() {
        return FleetSource.APPS;
    }

    @Override
    public boolean isForAdoption() {
        return true;
    }

    @Override
    public List<PackageMatch> match(List<InstalledProgram> programs) {
        BrewCaskIndex brewCaskIndex = brewCaskIndexCache.getBrewCaskIndex();
        return programs.stream().map(app -> matchOf(app, brewCaskIndex)).toList();
    }

    private static PackageMatch matchOf(InstalledProgram app, BrewCaskIndex index) {
        String bundleId = bundleIdOf(app);
        if (isNeverMatched(app, bundleId)) {
            return PackageMatch.noPackage();
        }
        Set<String> names = namesOf(app);
        Set<String> strongNameCasks = strongNameCasks(names, index);
        Set<String> weakNameCasks = weakNameCasks(names, index);
        Set<String> exactIdCasks = index.withBundleId(bundleId);
        Set<String> prefixIdCasks = index.withBundleIdPrefixOf(bundleId);
        Set<String> idCasks = union(exactIdCasks, prefixIdCasks);
        Set<String> idAndStrongNameCasks = intersection(idCasks, strongNameCasks);
        Set<String> idAndWeakNameCasks = intersection(idCasks, weakNameCasks);
        if (!idAndStrongNameCasks.isEmpty()) {
            return oneOf(idAndStrongNameCasks, index);
        }
        if (!idAndWeakNameCasks.isEmpty()) {
            return oneOf(idAndWeakNameCasks, index);
        }
        if (!exactIdCasks.isEmpty()) {
            return oneOf(exactIdCasks, index);
        }
        if (!prefixIdCasks.isEmpty()) {
            return PackageMatch.noPackage();
        }
        return matchByNameOnly(bundleId, strongNameCasks, weakNameCasks, index);
    }

    // topLevelApp is null when Fleet sent no path: unknown is allowed, only a known nested app is refused
    private static boolean isNeverMatched(InstalledProgram app, String bundleId) {
        return bundleId.startsWith(APPLE_BUNDLE_ID_PREFIX) || Boolean.FALSE.equals(app.getTopLevelApp());
    }

    private static String bundleIdOf(InstalledProgram app) {
        return StringUtils.stripToEmpty(app.getBundleIdentifier()).toLowerCase(Locale.ROOT);
    }

    // Fleet's name of an app is its display name, not its file: the file names are used when the device sent paths
    private static Set<String> namesOf(InstalledProgram app) {
        List<String> appFileNames = app.getAppFileNames();
        String displayName = displayNameOf(app);
        Stream<String> names = appFileNames.isEmpty() ? Stream.of(displayName) : appFileNames.stream();
        return names
                .map(name -> name.strip().toLowerCase(Locale.ROOT))
                .filter(name -> !name.isEmpty())
                .collect(toSet());
    }

    private static String displayNameOf(InstalledProgram app) {
        String name = StringUtils.stripToEmpty(app.getName()).toLowerCase(Locale.ROOT);
        return name.endsWith(APP_SUFFIX) ? name.substring(0, name.length() - APP_SUFFIX.length()) : name;
    }

    private static Set<String> strongNameCasks(Set<String> names, BrewCaskIndex index) {
        Set<String> tokens = names.stream().map(BrewAppMatcher::tokenOf).collect(toSet());
        Set<String> installingTheApp = index.installing(names);
        Set<String> namedAsTheApp = index.named(tokens);
        return union(installingTheApp, namedAsTheApp);
    }

    private static Set<String> weakNameCasks(Set<String> names, BrewCaskIndex index) {
        Set<String> removingTheApp = index.removing(names);
        Set<String> displayedAsTheApp = index.displayedAs(names);
        return union(removingTheApp, displayedAsTheApp);
    }

    private static String tokenOf(String lowerCaseName) {
        String token = lowerCaseName.replace("+", " plus ").replaceAll("[^a-z0-9]+", TOKEN_SEPARATOR);
        return StringUtils.strip(token, TOKEN_SEPARATOR);
    }

    private static PackageMatch matchByNameOnly(String bundleId, Set<String> strongNameCasks, Set<String> weakNameCasks,
                                                BrewCaskIndex index) {
        boolean byWeakName = strongNameCasks.isEmpty();
        Set<String> candidates = withoutVariantsOfTheirBase(byWeakName ? weakNameCasks : strongNameCasks);
        if (candidates.isEmpty()) {
            return PackageMatch.noPackage();
        }
        if (candidates.size() > 1) {
            return PackageMatch.ambiguous();
        }
        String token = candidates.iterator().next();
        boolean variantByWeakName = byWeakName && token.contains(VARIANT_SEPARATOR);
        boolean caskOfAnotherBundleId = !bundleId.isEmpty() && index.namesBundleIds(token);
        if (variantByWeakName || caskOfAnotherBundleId) {
            return PackageMatch.noPackage();
        }
        PackageCatalogEntry cask = index.caskOf(token);
        return PackageMatch.of(cask);
    }

    private static PackageMatch oneOf(Set<String> casks, BrewCaskIndex index) {
        Set<String> candidates = withoutVariantsOfTheirBase(casks);
        if (candidates.size() > 1) {
            return PackageMatch.ambiguous();
        }
        String token = candidates.iterator().next();
        PackageCatalogEntry cask = index.caskOf(token);
        return PackageMatch.of(cask);
    }

    // only a base with its own @variants answers as one cask, the base; nothing else is merged
    private static Set<String> withoutVariantsOfTheirBase(Set<String> tokens) {
        return tokens.stream()
                .filter(base -> tokens.stream().allMatch(token -> isBaseOf(base, token)))
                .findFirst()
                .map(Set::of)
                .orElse(tokens);
    }

    private static boolean isBaseOf(String base, String token) {
        return token.equals(base) || token.startsWith(base + VARIANT_SEPARATOR);
    }

    private static Set<String> union(Set<String> first, Set<String> second) {
        Set<String> union = new HashSet<>(first);
        union.addAll(second);
        return union;
    }

    private static Set<String> intersection(Set<String> first, Set<String> second) {
        Set<String> intersection = new HashSet<>(first);
        intersection.retainAll(second);
        return intersection;
    }
}
