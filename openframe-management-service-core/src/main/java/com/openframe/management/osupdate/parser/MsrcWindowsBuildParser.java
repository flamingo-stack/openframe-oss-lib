package com.openframe.management.osupdate.parser;

import com.openframe.core.util.SoftwareVersions;
import com.openframe.management.osupdate.MsrcWindowsBuild;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfEntry;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfProduct;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfProductTree;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfVulnerability;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// The latest cumulative security update, and its hotpatch, of every Windows client version one MSRC CVRF document
// names.
@Component
public class MsrcWindowsBuildParser {

    private static final int REMEDIATION_VENDOR_FIX = 2;
    // WARNING: only these two kinds of fix carry an OS build a device can report. A servicing stack update has the
    // version of the servicing stack in the same field, in the same numbering.
    private static final String CUMULATIVE_UPDATE = "Security Update";
    private static final String HOTPATCH = "Security Hotpatch Update";
    // WARNING: anchored on purpose. Servers have no such name, and an app "... on Windows 11 version 26H1" carries
    // the version of the app as its fixed build. MSRC writes both "Version" and "version".
    private static final Pattern WINDOWS_VERSION_PRODUCT =
            Pattern.compile("^Windows (\\d+) Version (\\S+) for .+", Pattern.CASE_INSENSITIVE);
    private static final Pattern WINDOWS_FIXED_BUILD = Pattern.compile("^10\\.0\\.(\\d+\\.\\d+)$");

    // WARNING: a hotpatch counts only when it fixes a vulnerability the latest cumulative update fixes. A month
    // without a hotpatch still lists older hotpatches, on older vulnerabilities MSRC released again.
    Map<String, MsrcWindowsBuild> parse(MsrcCvrfDocument msrcCvrfDocument) {
        Map<String, String> osVersionsByProductId = toOsVersionsByProductId(msrcCvrfDocument.getMsrcCvrfProductTree());
        Map<String, Map<String, String>> hotpatchBuildsByCumulativeBuildByOsVersion = new HashMap<>();
        for (MsrcCvrfVulnerability msrcCvrfVulnerability : orEmpty(msrcCvrfDocument.getMsrcCvrfVulnerabilities())) {
            addFixes(msrcCvrfVulnerability, osVersionsByProductId, hotpatchBuildsByCumulativeBuildByOsVersion);
        }
        Map<String, MsrcWindowsBuild> msrcWindowsBuilds = new HashMap<>();
        hotpatchBuildsByCumulativeBuildByOsVersion.forEach((osVersion, hotpatchBuildsByCumulativeBuild) -> {
            String latestBuild = hotpatchBuildsByCumulativeBuild.keySet().stream()
                    .reduce(MsrcWindowsBuildParser::higherBuild)
                    .orElseThrow();
            msrcWindowsBuilds.put(osVersion, MsrcWindowsBuild.builder()
                    .latestBuild(latestBuild)
                    .hotpatchBuild(hotpatchBuildsByCumulativeBuild.get(latestBuild))
                    .build());
        });
        return msrcWindowsBuilds;
    }

    // Per Windows version: every cumulative build of the vulnerability gets its highest hotpatch build, or none.
    private static void addFixes(MsrcCvrfVulnerability msrcCvrfVulnerability,
                                 Map<String, String> osVersionsByProductId,
                                 Map<String, Map<String, String>> hotpatchBuildsByCumulativeBuildByOsVersion) {
        Map<String, Set<String>> cumulativeBuildsByOsVersion = new HashMap<>();
        Map<String, String> hotpatchBuildsByOsVersion = new HashMap<>();
        for (MsrcCvrfEntry remediation : orEmpty(msrcCvrfVulnerability.getRemediations())) {
            String build = toWindowsBuild(remediation);
            if (build == null) {
                continue;
            }
            for (String productId : orEmpty(remediation.getProductIds())) {
                String osVersion = osVersionsByProductId.get(productId);
                if (osVersion == null) {
                    continue;
                }
                if (CUMULATIVE_UPDATE.equals(remediation.getSubType())) {
                    cumulativeBuildsByOsVersion.computeIfAbsent(osVersion, key -> new HashSet<>()).add(build);
                } else if (HOTPATCH.equals(remediation.getSubType())) {
                    hotpatchBuildsByOsVersion.merge(osVersion, build, MsrcWindowsBuildParser::higherBuild);
                }
            }
        }
        cumulativeBuildsByOsVersion.forEach((osVersion, cumulativeBuilds) -> {
            Map<String, String> hotpatchBuildsByCumulativeBuild = hotpatchBuildsByCumulativeBuildByOsVersion
                    .computeIfAbsent(osVersion, key -> new HashMap<>());
            String hotpatchBuild = hotpatchBuildsByOsVersion.get(osVersion);
            for (String cumulativeBuild : cumulativeBuilds) {
                if (hotpatchBuild == null) {
                    hotpatchBuildsByCumulativeBuild.putIfAbsent(cumulativeBuild, null);
                } else {
                    hotpatchBuildsByCumulativeBuild
                            .merge(cumulativeBuild, hotpatchBuild, MsrcWindowsBuildParser::higherBuild);
                }
            }
        });
    }

    // Null = no vendor fix, or its fixed build is no Windows build: "10.0.26100.9974" is, without the "10.0.".
    private static String toWindowsBuild(MsrcCvrfEntry remediation) {
        if (!Objects.equals(remediation.getType(), REMEDIATION_VENDOR_FIX) || remediation.getFixedBuild() == null) {
            return null;
        }
        Matcher windowsFixedBuild = WINDOWS_FIXED_BUILD.matcher(remediation.getFixedBuild().trim());
        return windowsFixedBuild.matches() ? windowsFixedBuild.group(1) : null;
    }

    private static Map<String, String> toOsVersionsByProductId(MsrcCvrfProductTree msrcCvrfProductTree) {
        Map<String, String> osVersionsByProductId = new HashMap<>();
        if (msrcCvrfProductTree == null) {
            return osVersionsByProductId;
        }
        for (MsrcCvrfProduct msrcCvrfProduct : orEmpty(msrcCvrfProductTree.getMsrcCvrfProducts())) {
            if (msrcCvrfProduct.getProductId() == null || msrcCvrfProduct.getName() == null) {
                continue;
            }
            Matcher windowsVersionProduct = WINDOWS_VERSION_PRODUCT.matcher(msrcCvrfProduct.getName().trim());
            if (windowsVersionProduct.matches()) {
                String osVersion = windowsVersionProduct.group(1) + " " + windowsVersionProduct.group(2);
                osVersionsByProductId.put(msrcCvrfProduct.getProductId(), osVersion.toUpperCase(Locale.ROOT));
            }
        }
        return osVersionsByProductId;
    }

    private static String higherBuild(String first, String second) {
        return SoftwareVersions.compare(first, second) >= 0 ? first : second;
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return Objects.requireNonNullElse(list, List.of());
    }
}
