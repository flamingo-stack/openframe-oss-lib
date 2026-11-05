package com.openframe.api.service.rmm.software.matching;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.experimental.UtilityClass;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// A port of winget's NameNormalization.cpp (NormalizationVersion::Initial, the name half): winget's index keeps names
// normalized exactly this way, so any change here misses packages. WingetNameNormalizerTest runs winget's own test data.
@UtilityClass
class WingetNameNormalizer {

    private static final int FLAGS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS;
    private static final String SPACE_CHARS = " \f\n\r\t\u000B";
    private static final String CUT_MARKER = "@@";
    private static final int CUT_MARKER_SEARCH_FROM = 3;
    private static final String NO_ARCHITECTURE = "";

    private static final Pattern ARCHITECTURE_X32 =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(X32|X86)(?=\\P{Nd}|$)(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_X64 =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(X64|AMD64|X86([\\p{Pd}\\p{Pc}]64))(?=\\P{Nd}|$)(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_ARM64 =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(ARM64|AARCH64)(?=\\P{Nd}|$)(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_ARM =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(ARM32)(?=\\P{Nd}|$)(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_32_BIT =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(32[\\p{Pd}\\p{Pc}\\p{Z}]?BIT)S?(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_64_BIT =
            compile("(?<=^|[^\\p{L}\\p{Nd}])(64[\\p{Pd}\\p{Pc}\\p{Z}]?BIT)S?(?:\\sEDITION)?");
    private static final Pattern ARCHITECTURE_32_OR_64_BIT =
            compile("(?<=^|[^\\p{L}\\p{Nd}])((64[\\\\\\/]32|32[\\\\\\/]64)[\\p{Pd}\\p{Pc}\\p{Z}]?BIT)S?(?:\\sEDITION)?");

    private static final Pattern LOCALE =
            compile("(?<![A-Z])((?:\\p{Lu}{2,3}(-(CANS|CYRL|LATN|MONG))?-\\p{Lu}{2})(?![A-Z])(?:-VALENCIA)?)");
    private static final Pattern SAP_PACKAGE = compile("^(?:[\\p{Lu}\\p{Nd}]+[\\._])+[\\p{Lu}\\p{Nd}]+"
            + "(?:-(?:\\p{Nd}+\\.)+\\p{Nd}+)(?:-(?:\\p{Lu}{2}(?:_\\p{Lu}{2})?|CORE))(?:-(?:\\p{Lu}{2}|\\p{Nd}{2}))$");
    private static final Pattern KB_NUMBERS = compile("\\((KB\\d+)\\)");
    private static final Pattern NON_LETTERS_AND_DIGITS = compile("[^\\p{L}\\p{Nd}]");
    private static final Pattern URI_PROTOCOL = compile("(?<!\\p{L})(?:http[s]?|ftp):\\/\\/");
    private static final Pattern VERSION_DELIMITED = compile("((?<!\\p{L})"
            + "(?:V|VER|VERSI(?:O|\u00D3)N|VERS\u00C3O|VERSIE|WERSJA|BUILD|RELEASE|RC|SP)\\P{L}?)?"
            + "\\p{Nd}+([\\p{Po}\\p{Pd}\\p{Pc}]\\p{Nd}?(RC|B|A|R|SP|K)?\\p{Nd}+)+([\\p{Po}\\p{Pd}\\p{Pc}]?[\\p{L}\\p{Nd}]+)*");
    private static final Pattern VERSION = compile("(FOR\\s)?(?<!\\p{L})"
            + "(?:P|V|R|VER|VERSI(?:O|\u00D3)N|VERS\u00C3O|VERSIE|WERSJA|BUILD|RELEASE|RC|SP)"
            + "(?:\\P{L}|\\P{L}\\p{L})?(\\p{Nd}|\\.\\p{Nd})+(?:RC|B|A|R|V|SP)?\\p{Nd}?");
    private static final Pattern VERSION_LETTER = compile("(?<!\\p{L})"
            + "(?:(?:V|VER|VERSI(?:O|\u00D3)N|VERS\u00C3O|VERSIE|WERSJA|BUILD|RELEASE|RC|SP)\\P{L})?"
            + "\\p{Lu}\\p{Nd}+(?:[\\p{Po}\\p{Pd}\\p{Pc}]\\p{Nd}+)+");
    private static final Pattern NON_NESTED_BRACKET = compile("\\([^\\(\\)]*\\)|\\[[^\\[\\]]*\\]");
    private static final Pattern BRACKET_ENCLOSED = compile("(?:\\p{Ps}.*\\p{Pe}|\".*\")");
    private static final Pattern LEADING_SYMBOLS = compile("^[^\\p{L}\\p{Nd}]+");
    private static final Pattern PREFIX_PARENS = compile("^\\(.*?\\)");
    private static final Pattern EMPTY_PARENS = compile("(\\(\\s*\\)|\\[\\s*\\]|\"\\s*\")");
    private static final Pattern EN = compile("\\sEN\\s*$");
    private static final Pattern TRAILING_SYMBOLS = compile("[^\\p{L}\\p{Nd}]+$");
    private static final Pattern FILE_PATH = compile("((INSTALLED\\sAT|IN)\\s)?[CDEF]:\\\\(.+?\\\\)*[^\\s]*\\\\?");
    private static final Pattern FILE_PATH_GHS = compile("\\(CHANGE #\\d{1,2} TO [CDEF]:\\\\(.+?\\\\)*[^\\s]*\\\\?\\)");
    private static final Pattern FILE_PATH_PARENS = compile("\\([CDEF]:\\\\(.+?\\\\)*[^\\s]*\\\\?\\)");
    private static final Pattern FILE_PATH_QUOTES = compile("\"[CDEF]:\\\\(.+?\\\\)*[^\\s]*\\\\?\"");
    private static final Pattern ROBLOX = compile("(?<=^ROBLOX\\s(PLAYER|STUDIO))(\\sFOR\\s.*)");
    private static final Pattern BOMGAR = compile(
            "(?<=^BOMGAR\\s(JUMP CLIENT|(ACCESS|REPRESENTATIVE) CONSOLE|BUTTON)|^EMBEDDED CALLBACK)(\\s.*)");
    private static final Pattern PROGRAM_NAME_SPLIT = compile("[^\\p{L}\\p{Nd}\\+\\&]");

    private static final List<Pattern> PROGRAM_NAME_PATTERNS = List.of(ROBLOX, BOMGAR, PREFIX_PARENS, EMPTY_PARENS,
            FILE_PATH_GHS, FILE_PATH_PARENS, FILE_PATH_QUOTES, FILE_PATH, VERSION_LETTER, VERSION_DELIMITED, VERSION, EN,
            NON_NESTED_BRACKET, BRACKET_ENCLOSED, URI_PROTOCOL, LEADING_SYMBOLS, TRAILING_SYMBOLS);

    // first removal wins, in winget's order: "32/64 bit" before "64 bit", "x86-64" before "x86"
    private static final List<ArchitecturePattern> ARCHITECTURES = List.of(
            new ArchitecturePattern(ARCHITECTURE_32_OR_64_BIT, NO_ARCHITECTURE),
            new ArchitecturePattern(ARCHITECTURE_X64, "X64"),
            new ArchitecturePattern(ARCHITECTURE_64_BIT, "X64"),
            new ArchitecturePattern(ARCHITECTURE_X32, "X86"),
            new ArchitecturePattern(ARCHITECTURE_32_BIT, "X86"),
            new ArchitecturePattern(ARCHITECTURE_ARM64, "Arm64"),
            new ArchitecturePattern(ARCHITECTURE_ARM, "Arm"));

    private static final Set<String> LOCALES = folded(Stream.of(
            "AF-ZA", "AM-ET", "AR-AE", "AR-BH", "AR-DZ", "AR-EG", "AR-IQ", "AR-JO", "AR-KW", "AR-LB", "AR-LY",
            "AR-MA", "ARN-CL", "AR-OM", "AR-QA", "AR-SA", "AR-SY", "AR-TN", "AR-YE", "AS-IN", "BA-RU", "BE-BY",
            "BG-BG", "BN-BD", "BN-IN", "BO-CN", "BR-FR", "CA-ES", "CA-ES-VALENCIA",
            "CO-FR", "CS-CZ", "CY-GB", "DA-DK", "DE-AT",
            "DE-CH", "DE-DE", "DE-LI", "DE-LU", "DSB-DE", "DV-MV", "EL-GR", "EN-AU", "EN-BZ", "EN-CA", "EN-GB",
            "EN-IE", "EN-IN", "EN-JM", "EN-MY", "EN-NZ", "EN-PH", "EN-SG", "EN-TT", "EN-US", "EN-ZA", "EN-ZW",
            "ES-AR", "ES-BO", "ES-CL", "ES-CO", "ES-CR", "ES-DO", "ES-EC", "ES-ES", "ES-GT", "ES-HN", "ES-MX",
            "ES-NI", "ES-PA", "ES-PE", "ES-PR", "ES-PY", "ES-SV", "ES-US", "ES-UY", "ES-VE", "ET-EE", "EU-ES",
            "FA-IR", "FI-FI", "FIL-PH", "FO-FO", "FR-BE", "FR-CA", "FR-CH", "FR-FR", "FR-LU", "FR-MC", "FY-NL",
            "GA-IE", "GD-DB", "GL-ES", "GSW-FR", "GU-IN", "HE-IL", "HI-IN", "HR-BA", "HR-HR", "HSB-DE", "HU-HU",
            "HY-AM", "ID-ID", "IG-NG", "II-CN", "IS-IS", "IT-CH", "IT-IT", "JA-JP", "KA-GE", "KK-KZ", "KL-GL",
            "KM-KH", "KN-IN", "KOK-IN", "KO-KR", "KY-KG", "LB-LU", "LO-LA", "LT-LT", "LV-LV", "MI-NZ", "MK-MK",
            "ML-IN", "MN-MN", "MOH-CA", "MR-IN", "MS-BN", "MS-MY", "MT-MT", "NB-NO", "NE-NP", "NL-BE", "NL-NL",
            "NN-NO", "NSO-ZA", "OC-FR", "OR-IN", "PA-IN", "PL-PL", "PRS-AF", "PS-AF", "PT-BR", "PT-PT", "QUT-GT",
            "QUZ-BO", "QUZ-EC", "QUZ-PE", "RM-CH", "RO-RO", "RU-RU", "RW-RW", "SAH-RU", "SA-IN", "SE-FI", "SE-NO",
            "SE-SE", "SI-LK", "SK-SK", "SL-SI", "SMA-NO", "SMA-SE", "SMJ-NO", "SMJ-SE", "SMN-FI", "SMS-FI", "SQ-AL",
            "SV-FI", "SV-SE", "SW-KE", "SYR-SY", "TA-IN", "TE-IN", "TH-TH", "TK-TM", "TN-ZA", "TR-TR", "TT-RU",
            "UG-CN", "UK-UA", "UR-PK", "VI-VN", "WO-SN", "XH-ZA", "YO-NG", "ZH-CN", "ZH-HK", "ZH-MO", "ZH-SG",
            "ZH-TW", "ZU-ZA", "AZ-CYRL-AZ", "AZ-LATN-AZ", "BS-CYRL-BA", "BS-LATN-BA", "HA-LATN-NG", "IU-CANS-CA",
            "IU-LATN-CA", "MN-MONG-CN", "SR-CYRL-BA", "SR-CYRL-CS", "SR-CYRL-ME", "SR-CYRL-RS", "SR-LATN-BA",
            "SR-LATN-CS", "SR-LATN-ME", "SR-LATN-RS", "TG-CYRL-TJ", "TZM-LATN-DZ", "UZ-CYRL-UZ", "UZ-LATN-UZ"));

    private static final Set<String> LEGAL_ENTITY_SUFFIXES = folded(Stream.of(
            "AB", "AD", "AG", "APS", "AS", "ASA", "BV", "CO", "CV", "DOO", "eV", "GES", "GESMBH", "GMBH", "INC", "KG",
            "KS", "PS", "LLC", "LP", "LTD", "LTDA", "MBH", "NV", "PLC", "SL", "PTY", "PVT", "SA", "SARL",
            "SC", "SCA", "SL", "SP", "SPA", "SRL", "SRO",
            "COMPANY", "CORP", "CORPORATION", "HOLDING", "HOLDINGS", "INCORPORATED", "LIMITED", "SUBSIDIARY"));

    static List<String> searchNames(String displayName) {
        String folded = fold(displayName);
        NormalizedName normalized = normalize(folded);
        String name = normalized.getName();
        if (name.isEmpty()) {
            return List.of();
        }
        if (normalized.hasArchitecture()) {
            String withArchitecture = name + "(" + normalized.getArchitecture() + ")";
            return List.of(withArchitecture, name);
        }
        return List.of(name);
    }

    static NormalizedName normalize(String name) {
        String prepared = prepare(name);
        String value = unwrap(prepared);
        if (SAP_PACKAGE.matcher(value).matches()) {
            return new NormalizedName(value, NO_ARCHITECTURE);
        }
        NormalizedName withoutArchitecture = removeArchitecture(value);
        String withoutLocales = removeLocales(withoutArchitecture.getName());
        String withKbNumbers = KB_NUMBERS.matcher(withoutLocales).replaceAll("$1");
        String reduced = removeProgramNameNoise(withKbNumbers);
        List<String> words = words(reduced);
        String joined = String.join("", words);
        String normalized = NON_LETTERS_AND_DIGITS.matcher(joined).replaceAll("");
        return new NormalizedName(normalized, withoutArchitecture.getArchitecture());
    }

    private static String prepare(String value) {
        String composed = Normalizer.normalize(value, Normalizer.Form.NFKC);
        String trimmed = trim(composed);
        int cut = trimmed.indexOf(CUT_MARKER, CUT_MARKER_SEARCH_FROM);
        return cut < 0 ? trimmed : trimmed.substring(0, cut);
    }

    private static String trim(String value) {
        int start = 0;
        int end = value.length();
        while (start < end && isSpace(value.charAt(start))) {
            start++;
        }
        while (end > start && isSpace(value.charAt(end - 1))) {
            end--;
        }
        return value.substring(start, end);
    }

    private static String unwrap(String value) {
        String current = value;
        while (isWrapped(current)) {
            current = current.substring(1, current.length() - 1);
        }
        return current;
    }

    private static boolean isWrapped(String value) {
        if (value.length() < 2) {
            return false;
        }
        char first = value.charAt(0);
        char last = value.charAt(value.length() - 1);
        return (first == '"' && last == '"') || (first == '(' && last == ')');
    }

    private static NormalizedName removeArchitecture(String value) {
        for (ArchitecturePattern architecture : ARCHITECTURES) {
            String removed = architecture.getPattern().matcher(value).replaceAll("");
            if (!removed.equals(value)) {
                return new NormalizedName(removed, architecture.getLabel());
            }
        }
        return new NormalizedName(value, NO_ARCHITECTURE);
    }

    private static String removeLocales(String value) {
        Matcher matcher = LOCALE.matcher(value);
        StringBuilder kept = new StringBuilder();
        while (matcher.find()) {
            String found = matcher.group();
            String replacement = isKnownLocale(found) ? "" : Matcher.quoteReplacement(found);
            matcher.appendReplacement(kept, replacement);
        }
        matcher.appendTail(kept);
        return kept.toString();
    }

    private static boolean isKnownLocale(String value) {
        String folded = fold(value);
        return LOCALES.contains(folded);
    }

    private static String removeProgramNameNoise(String value) {
        String current = value;
        String previous;
        do {
            previous = current;
            for (Pattern pattern : PROGRAM_NAME_PATTERNS) {
                current = pattern.matcher(current).replaceAll("");
            }
        } while (!current.equals(previous));
        return current;
    }

    private static List<String> words(String value) {
        List<String> words = new ArrayList<>();
        Matcher separators = PROGRAM_NAME_SPLIT.matcher(value);
        int start = 0;
        while (separators.find()) {
            String word = value.substring(start, separators.start());
            addWord(words, word);
            addWord(words, separators.group());
            start = separators.end();
        }
        String last = value.substring(start);
        addWord(words, last);
        return words;
    }

    private static void addWord(List<String> words, String segment) {
        if (isBlank(segment) || isLegalEntitySuffixAfterFirstWord(words, segment)) {
            return;
        }
        words.add(segment);
    }

    private static boolean isLegalEntitySuffixAfterFirstWord(List<String> words, String segment) {
        String folded = fold(segment);
        return !words.isEmpty() && LEGAL_ENTITY_SUFFIXES.contains(folded);
    }

    private static boolean isBlank(String value) {
        return value.chars().allMatch(WingetNameNormalizer::isSpace);
    }

    private static boolean isSpace(int c) {
        return SPACE_CHARS.indexOf(c) >= 0;
    }

    // stands in for ICU's full case folding (ß becomes ss), which winget applies before normalizing
    private static String fold(String value) {
        String upper = value.toUpperCase(Locale.ROOT);
        return upper.toLowerCase(Locale.ROOT);
    }

    private static Set<String> folded(Stream<String> values) {
        return values.map(WingetNameNormalizer::fold).collect(Collectors.toUnmodifiableSet());
    }

    private static Pattern compile(String regex) {
        return Pattern.compile(regex, FLAGS);
    }

    @Getter
    @AllArgsConstructor
    static class NormalizedName {
        private final String name;
        private final String architecture;

        boolean hasArchitecture() {
            return !architecture.isEmpty();
        }
    }

    @Getter
    @AllArgsConstructor
    private static class ArchitecturePattern {
        private final Pattern pattern;
        private final String label;
    }
}
