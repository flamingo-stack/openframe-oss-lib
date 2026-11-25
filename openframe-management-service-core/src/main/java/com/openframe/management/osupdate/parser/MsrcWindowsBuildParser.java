package com.openframe.management.osupdate.parser;

import com.openframe.core.util.SoftwareVersions;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfEntry;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfProduct;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfProductTree;
import com.openframe.management.osupdate.parser.MsrcCvrfDocument.MsrcCvrfVulnerability;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// The highest fixed build of every Windows client version one MSRC CVRF document names.
@Component
public class MsrcWindowsBuildParser {

    private static final int REMEDIATION_VENDOR_FIX = 2;
    // WARNING: anchored on purpose. Servers have no such name, and an app "... on Windows 11 version 26H1" carries
    // the version of the app as its fixed build. MSRC writes both "Version" and "version".
    private static final Pattern WINDOWS_VERSION_PRODUCT =
            Pattern.compile("^Windows (\\d+) Version (\\S+) for .+", Pattern.CASE_INSENSITIVE);
    private static final Pattern WINDOWS_FIXED_BUILD = Pattern.compile("^10\\.0\\.(\\d+\\.\\d+)$");

    Map<String, String> parseLatestBuilds(MsrcCvrfDocument msrcCvrfDocument) {
        Map<String, String> osVersionsByProductId = toOsVersionsByProductId(msrcCvrfDocument.getMsrcCvrfProductTree());
        Map<String, String> latestBuilds = new HashMap<>();
        if (osVersionsByProductId.isEmpty()) {
            return latestBuilds;
        }
        for (MsrcCvrfVulnerability msrcCvrfVulnerability : orEmpty(msrcCvrfDocument.getMsrcCvrfVulnerabilities())) {
            for (MsrcCvrfEntry remediation : orEmpty(msrcCvrfVulnerability.getRemediations())) {
                addFixedBuild(remediation, osVersionsByProductId, latestBuilds);
            }
        }
        return latestBuilds;
    }

    private static void addFixedBuild(MsrcCvrfEntry remediation, Map<String, String> osVersionsByProductId,
                                      Map<String, String> latestBuilds) {
        if (!Objects.equals(remediation.getType(), REMEDIATION_VENDOR_FIX) || remediation.getFixedBuild() == null) {
            return;
        }
        Matcher windowsFixedBuild = WINDOWS_FIXED_BUILD.matcher(remediation.getFixedBuild().trim());
        if (!windowsFixedBuild.matches()) {
            return;
        }
        String build = windowsFixedBuild.group(1);
        for (String productId : orEmpty(remediation.getProductIds())) {
            String osVersion = osVersionsByProductId.get(productId);
            if (osVersion != null) {
                latestBuilds.merge(osVersion, build, MsrcWindowsBuildParser::higherBuild);
            }
        }
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
