package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import lombok.experimental.UtilityClass;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.MatchResult;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.apache.commons.lang3.StringUtils.countMatches;
import static org.apache.commons.lang3.StringUtils.defaultString;
import static org.apache.commons.lang3.StringUtils.endsWithIgnoreCase;

@UtilityClass
class PackageCandidateTieBreak {

    private static final String ID_SEPARATOR = ".";
    private static final String NO_VERSION = "";
    private static final String VERSION_SEGMENTS = "\\d+(?:_\\d+)?(?:\\.\\d+(?:_\\d+)?)*";
    private static final String VARIANT_WORDS = "beta|rc|nightly|canary|preview|prerelease|dev|alpha|insiders|eap"
            + "|arm64|x86|x64|msi|exe|portable|msix|cn|lite|ltsr|lts|hotdesking|essentials|shared|bundle";
    private static final String LOCALE_CODES = "[a-z]{2,3}(?:-[a-z]{2,4})?|ca-valencia";

    private static final Pattern VERSION_IN_NAME =
            Pattern.compile("(?<![a-z\\d_])v?(\\d+(?:\\.\\d+)*)(?!\\d|[- ]?bit)", Pattern.CASE_INSENSITIVE);
    private static final Pattern VERSION_IN_ID = Pattern.compile("\\.(" + VERSION_SEGMENTS + ")(?=\\.|$)");
    private static final Pattern VERSION_ENDING_ID = Pattern.compile(
            "\\.(" + VERSION_SEGMENTS + ")(?:\\.(?:" + VARIANT_WORDS + "))*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern VERSION_SUFFIX = Pattern.compile("\\d+(?:_\\d+)?(?:\\..*)?");
    private static final Pattern VARIANT_SUFFIX = Pattern.compile(
            "(?:" + VARIANT_WORDS + "|" + LOCALE_CODES + ")(?:\\..*)?", Pattern.CASE_INSENSITIVE);
    private static final Pattern ARCHITECTURE_WORD = Pattern.compile("\\b(?:x64|x86|arm64)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern PERSONAL_EDITION = Pattern.compile("\\(personal\\)", Pattern.CASE_INSENSITIVE);
    private static final String FREE_EDITION_SUFFIX = ".Free";
    private static final Pattern LETTER = Pattern.compile("[a-z]", Pattern.CASE_INSENSITIVE);
    private static final String NOT_LETTER_OR_DIGIT = "[^a-z0-9]";
    private static final Comparator<String> SHORTEST_FIRST = Comparator.comparingInt(String::length);

    static List<PackageCatalogEntry> narrow(String programName, List<PackageCatalogEntry> candidates) {
        List<String> ids = candidates.stream().map(PackageCatalogEntry::getPackageId).toList();
        Optional<String> decided = versionMember(programName, ids)
                .or(() -> baseOfVariants(ids))
                .or(() -> architectureMember(programName, ids))
                .or(() -> personalEdition(programName, ids))
                .or(() -> baseOfEditions(programName, ids));
        return decided
                .map(id -> withId(id, candidates))
                .orElse(candidates);
    }

    static boolean isOfAnotherVersion(String programName, PackageCatalogEntry entry) {
        List<String> installedVersions = versionsIn(programName);
        String id = entry.getPackageId();
        List<String> idVersions = versionsInId(id);
        if (installedVersions.isEmpty() || idVersions.isEmpty()) {
            return false;
        }
        String catalogName = defaultString(entry.getName());
        List<String> nameVersions = versionsIn(catalogName);
        return Stream.of(idVersions, nameVersions)
                .flatMap(List::stream)
                .noneMatch(version -> isInstalled(version, installedVersions));
    }

    private static List<PackageCatalogEntry> withId(String id, List<PackageCatalogEntry> candidates) {
        return candidates.stream()
                .filter(candidate -> id.equals(candidate.getPackageId()))
                .toList();
    }

    private static Optional<String> versionMember(String programName, List<String> ids) {
        List<String> installedVersions = versionsIn(programName);
        List<String> members = ids.stream()
                .filter(id -> isOfVersion(id, installedVersions))
                .toList();
        int longest = members.stream().mapToInt(PackageCandidateTieBreak::versionLength).max().orElse(0);
        List<String> closest = members.stream()
                .filter(id -> versionLength(id) == longest)
                .toList();
        return baseOf(closest);
    }

    private static Optional<String> baseOfVariants(List<String> ids) {
        return baseOf(ids)
                .filter(base -> suffixesOf(base, ids).allMatch(PackageCandidateTieBreak::isVariant));
    }

    private static Optional<String> architectureMember(String programName, List<String> ids) {
        Matcher architecture = ARCHITECTURE_WORD.matcher(programName);
        if (!architecture.find()) {
            return Optional.empty();
        }
        String suffix = ID_SEPARATOR + architecture.group();
        return onlyOneEndingWith(suffix, ids);
    }

    private static Optional<String> personalEdition(String programName, List<String> ids) {
        return isPersonal(programName) ? onlyOneEndingWith(FREE_EDITION_SUFFIX, ids) : Optional.empty();
    }

    private static boolean isPersonal(String programName) {
        return PERSONAL_EDITION.matcher(programName).find();
    }

    private static Optional<String> baseOfEditions(String programName, List<String> ids) {
        if (isPersonal(programName)) {
            return Optional.empty();
        }
        boolean versionInName = !versionsIn(programName).isEmpty();
        String nameLetters = lettersAndDigits(programName);
        return baseOf(ids)
                .filter(base -> suffixesOf(base, ids).noneMatch(suffix -> isNamedIn(nameLetters, suffix)))
                .filter(base -> versionInName || suffixesOf(base, ids).noneMatch(PackageCandidateTieBreak::isVersion));
    }

    private static Optional<String> baseOf(List<String> ids) {
        return ids.stream()
                .min(SHORTEST_FIRST)
                .filter(base -> ids.stream().allMatch(id -> id.equals(base) || isBasedOn(base, id)));
    }

    private static boolean isBasedOn(String base, String id) {
        return id.startsWith(base + ID_SEPARATOR);
    }

    private static Stream<String> suffixesOf(String base, List<String> ids) {
        int from = base.length() + ID_SEPARATOR.length();
        return ids.stream()
                .filter(id -> !id.equals(base))
                .map(id -> id.substring(from));
    }

    private static boolean isVariant(String suffix) {
        return VARIANT_SUFFIX.matcher(suffix).matches();
    }

    private static boolean isVersion(String suffix) {
        return VERSION_SUFFIX.matcher(suffix).matches();
    }

    private static boolean isNamedIn(String nameLetters, String suffix) {
        String suffixLetters = lettersAndDigits(suffix);
        return LETTER.matcher(suffix).find() && nameLetters.contains(suffixLetters);
    }

    private static Optional<String> onlyOneEndingWith(String suffix, List<String> ids) {
        List<String> members = ids.stream()
                .filter(id -> endsWithIgnoreCase(id, suffix))
                .toList();
        return members.size() == 1 ? Optional.of(members.getFirst()) : Optional.empty();
    }

    private static boolean isOfVersion(String id, List<String> installedVersions) {
        String version = versionEnding(id);
        return isInstalled(version, installedVersions);
    }

    private static int versionLength(String id) {
        String version = versionEnding(id);
        return countMatches(version, ID_SEPARATOR);
    }

    // the whole version of the id is compared: its last part alone sends every Python 3.x to Python.Python.3.3
    private static boolean isInstalled(String version, List<String> installedVersions) {
        return installedVersions.stream()
                .anyMatch(installed -> installed.equals(version) || installed.startsWith(version + ID_SEPARATOR));
    }

    private static String versionEnding(String id) {
        Matcher version = VERSION_ENDING_ID.matcher(id);
        return version.find() ? dotted(version) : NO_VERSION;
    }

    private static List<String> versionsInId(String id) {
        return VERSION_IN_ID.matcher(id).results()
                .map(PackageCandidateTieBreak::dotted)
                .toList();
    }

    private static List<String> versionsIn(String text) {
        return VERSION_IN_NAME.matcher(text).results()
                .map(found -> found.group(1))
                .toList();
    }

    private static String dotted(MatchResult idVersion) {
        return idVersion.group(1).replace('_', '.');
    }

    private static String lettersAndDigits(String text) {
        return text.toLowerCase(Locale.ROOT).replaceAll(NOT_LETTER_OR_DIGIT, "");
    }
}
