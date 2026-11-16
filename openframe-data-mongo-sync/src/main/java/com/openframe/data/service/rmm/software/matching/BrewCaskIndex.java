package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.mapping;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

public class BrewCaskIndex {

    private final Map<String, PackageCatalogEntry> caskByToken;
    private final Map<String, Set<String>> tokensByAppName;
    private final Map<String, Set<String>> tokensByRemovedAppName;
    private final Map<String, Set<String>> tokensByDisplayName;
    private final Map<String, Set<String>> tokensByAnyToken;
    private final Map<String, Set<String>> tokensByBundleId;
    private final Map<String, Set<String>> tokensByBundleIdPrefix;

    public BrewCaskIndex(List<PackageCatalogEntry> casks) {
        List<PackageCatalogEntry> withKeys = casks.stream().filter(BrewCaskIndex::hasKeys).toList();
        this.caskByToken = withKeys.stream()
                .collect(toMap(PackageCatalogEntry::getPackageId, Function.identity(), (first, second) -> first));
        this.tokensByAppName = tokensBy(withKeys, cask -> cask.getAppNames().stream());
        this.tokensByRemovedAppName = tokensBy(withKeys, cask -> cask.getWeakAppNames().stream());
        this.tokensByDisplayName = tokensBy(withKeys, BrewCaskIndex::displayNameOf);
        this.tokensByAnyToken = tokensBy(withKeys, BrewCaskIndex::currentAndOldTokensOf);
        this.tokensByBundleId = tokensBy(withKeys, cask -> cask.getBundleIds().stream());
        this.tokensByBundleIdPrefix = tokensBy(withKeys, cask -> cask.getBundleIdPrefixes().stream());
    }

    public Set<String> installing(Collection<String> appNames) {
        return tokensOf(tokensByAppName, appNames);
    }

    public Set<String> removing(Collection<String> appNames) {
        return tokensOf(tokensByRemovedAppName, appNames);
    }

    public Set<String> displayedAs(Collection<String> names) {
        return tokensOf(tokensByDisplayName, names);
    }

    public Set<String> named(Collection<String> tokens) {
        return tokensOf(tokensByAnyToken, tokens);
    }

    public Set<String> withBundleId(String bundleId) {
        return tokensByBundleId.getOrDefault(bundleId, Set.of());
    }

    public Set<String> withBundleIdPrefixOf(String bundleId) {
        return tokensByBundleIdPrefix.entrySet().stream()
                .filter(tokensOfPrefix -> bundleId.startsWith(tokensOfPrefix.getKey()))
                .flatMap(tokensOfPrefix -> tokensOfPrefix.getValue().stream())
                .collect(toSet());
    }

    public boolean namesBundleIds(String token) {
        PackageCatalogEntry cask = caskByToken.get(token);
        return !cask.getBundleIds().isEmpty() || !cask.getBundleIdPrefixes().isEmpty();
    }

    public PackageCatalogEntry caskOf(String token) {
        return caskByToken.get(token);
    }

    // a cask without keys installs no app (a font, a command-line tool): its token and name must not answer an app
    private static boolean hasKeys(PackageCatalogEntry cask) {
        return cask.getPackageId() != null && cask.getAppNames() != null;
    }

    private static Stream<String> displayNameOf(PackageCatalogEntry cask) {
        return Stream.ofNullable(cask.getName()).map(name -> name.toLowerCase(Locale.ROOT));
    }

    private static Stream<String> currentAndOldTokensOf(PackageCatalogEntry cask) {
        Stream<String> token = Stream.of(cask.getPackageId());
        Stream<String> oldTokens = Stream.ofNullable(cask.getAliases()).flatMap(List::stream);
        return Stream.concat(token, oldTokens);
    }

    private static Map<String, Set<String>> tokensBy(List<PackageCatalogEntry> casks,
                                                     Function<PackageCatalogEntry, Stream<String>> keysOf) {
        return casks.stream()
                .flatMap(cask -> keysOf.apply(cask).map(key -> Map.entry(key, cask.getPackageId())))
                .collect(groupingBy(Map.Entry::getKey, mapping(Map.Entry::getValue, toSet())));
    }

    private static Set<String> tokensOf(Map<String, Set<String>> tokensByKey, Collection<String> keys) {
        return keys.stream()
                .map(tokensByKey::get)
                .flatMap(Stream::ofNullable)
                .flatMap(Set::stream)
                .collect(toSet());
    }
}
