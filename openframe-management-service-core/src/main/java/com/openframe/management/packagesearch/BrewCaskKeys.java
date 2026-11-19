package com.openframe.management.packagesearch;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class BrewCaskKeys {

    private static final BrewCaskKeys NONE = new BrewCaskKeys(null, null, null, null);

    private static final String APP_ARTIFACT = "app";
    private static final String TARGET = "target";
    private static final List<String> APP_INSTALLING_ARTIFACTS = List.of(APP_ARTIFACT, "pkg", "installer", "suite");
    private static final List<String> REMOVAL_STANZAS = List.of("uninstall", "zap");
    // "quit" ids are left out on purpose: they also name other apps the cask wants closed
    private static final List<String> REMOVAL_DIRECTIVES = List.of("delete", "trash", "rmdir");

    private static final Pattern APP_FILE = Pattern.compile("(?:.*/)?([^/]+)\\.app", Pattern.CASE_INSENSITIVE);
    private static final Pattern REMOVED_APP = Pattern.compile("~?/Applications/([^/*]+)\\.app");
    private static final List<Pattern> REMOVED_BUNDLE_ID_PATHS = List.of(
            Pattern.compile("~/Library/Preferences/([^/]+?)\\.plist"),
            Pattern.compile("~/Library/Saved Application State/([^/]+?)\\.savedState"),
            Pattern.compile("~/Library/(?:Caches|HTTPStorages|Containers|Application Scripts|WebKit)/([^/]+)"));
    private static final String REVERSE_DNS = "[A-Za-z0-9-]+(?:\\.[A-Za-z0-9_-]+)+";
    private static final Pattern BUNDLE_ID = Pattern.compile("(" + REVERSE_DNS + ")");
    private static final Pattern BUNDLE_ID_GLOB = Pattern.compile("(" + REVERSE_DNS + "\\.?)\\*");
    // a shorter prefix (com.a*) would claim the apps of other vendors
    private static final int MIN_BUNDLE_ID_PREFIX_LENGTH = 8;

    private final List<String> appNames;
    private final List<String> weakAppNames;
    private final List<String> bundleIds;
    private final List<String> bundleIdPrefixes;

    static BrewCaskKeys of(BrewCaskJson cask) {
        List<JsonNode> artifacts = cask.getArtifacts() == null ? List.of() : cask.getArtifacts();
        boolean installsApp = artifacts.stream().anyMatch(BrewCaskKeys::installsApp);
        if (!installsApp) {
            return NONE;
        }
        List<String> removedPaths = removedPathsOf(artifacts);
        List<String> removedIds = removedPaths.stream().flatMap(BrewCaskKeys::bundleIdIn).toList();
        Stream<String> installedApps = artifacts.stream()
                .flatMap(BrewCaskKeys::installedAppPathsOf)
                .flatMap(path -> groupOf(APP_FILE, path));
        Stream<String> removedApps = removedPaths.stream().flatMap(path -> groupOf(REMOVED_APP, path));
        Stream<String> exactIds = removedIds.stream().flatMap(id -> groupOf(BUNDLE_ID, id));
        Stream<String> idPrefixes = removedIds.stream()
                .flatMap(id -> groupOf(BUNDLE_ID_GLOB, id))
                .filter(prefix -> prefix.length() >= MIN_BUNDLE_ID_PREFIX_LENGTH);

        List<String> appNames = keysOf(installedApps);
        List<String> weakAppNames = keysOf(removedApps).stream().filter(name -> !appNames.contains(name)).toList();
        List<String> bundleIds = keysOf(exactIds);
        List<String> bundleIdPrefixes = keysOf(idPrefixes);
        return new BrewCaskKeys(appNames, weakAppNames, bundleIds, bundleIdPrefixes);
    }

    private static boolean installsApp(JsonNode artifact) {
        return APP_INSTALLING_ARTIFACTS.stream().anyMatch(artifact::has);
    }

    // an app is listed by its path in the download; a "target" beside it is the name it is installed under
    private static Stream<String> installedAppPathsOf(JsonNode artifact) {
        List<JsonNode> listed = artifact.path(APP_ARTIFACT).valueStream().toList();
        List<String> installedAs = listed.stream()
                .map(app -> app.path(TARGET))
                .flatMap(BrewCaskKeys::stringsOf)
                .toList();
        Stream<String> downloaded = listed.stream().filter(JsonNode::isString).map(JsonNode::stringValue);
        return installedAs.isEmpty() ? downloaded : installedAs.stream();
    }

    private static List<String> removedPathsOf(List<JsonNode> artifacts) {
        return artifacts.stream()
                .flatMap(artifact -> REMOVAL_STANZAS.stream().map(artifact::path))
                .flatMap(JsonNode::valueStream)
                .flatMap(block -> REMOVAL_DIRECTIVES.stream().map(block::path))
                .flatMap(BrewCaskKeys::stringsOf)
                .toList();
    }

    private static Stream<String> stringsOf(JsonNode value) {
        if (value.isString()) {
            return Stream.of(value.stringValue());
        }
        return value.valueStream().filter(JsonNode::isString).map(JsonNode::stringValue);
    }

    private static Stream<String> bundleIdIn(String removedPath) {
        return REMOVED_BUNDLE_ID_PATHS.stream().flatMap(idPath -> groupOf(idPath, removedPath));
    }

    private static Stream<String> groupOf(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value);
        return matcher.matches() ? Stream.of(matcher.group(1)) : Stream.empty();
    }

    private static List<String> keysOf(Stream<String> values) {
        return values.map(value -> value.toLowerCase(Locale.ROOT)).distinct().sorted().toList();
    }
}
