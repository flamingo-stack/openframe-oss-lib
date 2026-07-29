package com.openframe.data.document.rmm;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Operating-system platform on which a {@link Script} is supported.
 *
 * <p>The set is intentionally minimal; finer-grained distinctions (e.g.
 * specific Windows or distro versions) are expressed in the script body or
 * via execution-time arguments rather than as separate platform values.
 *
 * <p><b>Platform name vs stored {@code osType}.</b> These are two different
 * vocabularies and must never be compared directly. A platform is an enum
 * constant ({@code MACOS}); {@code Machine.osType} is whatever the agent
 * reported at registration and is persisted verbatim — the Rust agent sends
 * {@code "WINDOWS"} and {@code "MAC_OS"}, so a plain
 * {@code "MACOS".equalsIgnoreCase(osType)} silently excludes every Mac. Each
 * constant therefore carries the {@code osType} spellings that mean it, and all
 * comparisons go through {@link #matches}, {@link #osTypeMatches} or
 * {@link #osTypeRegex}.
 *
 * <p>Aliases are compared on a canonical form (lower-cased, separators removed),
 * so an unlisted spelling like {@code "Mac-OS"} still resolves. The alias list
 * additionally spells out the separator variants because {@link #osTypeRegex}
 * matches stored values as they are, without canonicalising them first.
 */
public enum ScriptPlatform {
    WINDOWS("windows", "win", "win32", "win64"),
    LINUX("linux", "ubuntu", "debian", "centos", "rhel", "red hat", "redhat", "fedora", "arch", "alpine"),
    MACOS("macos", "mac_os", "mac-os", "mac os", "macosx", "mac_os_x", "mac os x", "osx", "os x", "darwin");

    private final List<String> osTypeAliases;

    ScriptPlatform(String... osTypeAliases) {
        this.osTypeAliases = List.of(osTypeAliases);
    }

    /** Every {@code osType} spelling that means this platform. */
    public List<String> osTypeAliases() {
        return osTypeAliases;
    }

    /** Is a device reporting {@code osType} running this platform? */
    public boolean matches(String osType) {
        String canonical = canonical(osType);
        return canonical != null && osTypeAliases.stream().anyMatch(alias -> canonical.equals(canonical(alias)));
    }

    /** The platform a reported {@code osType} denotes, empty when it denotes none of them. */
    public static Optional<ScriptPlatform> fromOsType(String osType) {
        return Arrays.stream(values()).filter(platform -> platform.matches(osType)).findFirst();
    }

    /**
     * Does {@code platformName} describe a device running {@code osType}? {@code platformName} is
     * either a {@link ScriptPlatform} name or a raw osType coming from a saved device criteria;
     * one that denotes no known platform falls back to a direct case-insensitive comparison, so a
     * value this enum has never heard of still matches itself.
     */
    public static boolean osTypeMatches(String platformName, String osType) {
        if (platformName == null || osType == null) {
            return false;
        }
        return fromOsType(platformName)
                .map(platform -> platform.matches(osType))
                .orElseGet(() -> platformName.equalsIgnoreCase(osType));
    }

    /**
     * Anchored regex matching every stored spelling of {@code platformName} — for querying the
     * {@code osType} field, which holds the agent's spelling rather than a platform name. Intended
     * to be used with the case-insensitive flag. Anchoring is what keeps {@code "win"} from
     * matching {@code "darwin"}, and each alternative is quoted so a value carrying regex
     * metacharacters is matched literally.
     */
    public static String osTypeRegex(String platformName) {
        List<String> alternatives = fromOsType(platformName)
                .map(ScriptPlatform::osTypeAliases)
                .orElseGet(() -> List.of(platformName));
        return alternatives.stream()
                .map(Pattern::quote)
                .collect(Collectors.joining("|", "^(?:", ")$"));
    }

    private static String canonical(String value) {
        if (value == null) {
            return null;
        }
        String stripped = value.trim().toLowerCase().replaceAll("[\\s_-]", "");
        return stripped.isEmpty() ? null : stripped;
    }
}
