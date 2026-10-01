package com.openframe.test.data.generator;

import com.openframe.test.data.dto.softwarebundle.SoftwarePackageInput;
import com.openframe.test.data.dto.softwarebundle.SubmitSoftwareBundleInput;

import java.util.List;

// Inputs for submitSoftwareBundle; every submit here runs now (no schedule).
public class SoftwareBundleGenerator {

    public static final String WINGET = "WINGET";
    public static final String BREW = "BREW";
    public static final String INSTALL = "INSTALL";
    public static final String UPDATE = "UPDATE";
    // The small, harmless winget package SoftwareBundleTest installs on the shared box and removes again; its history is what SoftwareActionHistoryTest reads.
    public static final String HARMLESS_WINGET_PACKAGE = "7zip.7zip";

    public static SoftwarePackageInput wingetPackage(String packageId) {
        return SoftwarePackageInput.builder().packageManager(WINGET).packageName(packageId).build();
    }

    // A Homebrew package with no brewPackageType, which submit refuses.
    public static SoftwarePackageInput untypedBrewPackage(String name) {
        return SoftwarePackageInput.builder().packageManager(BREW).packageName(name).build();
    }

    public static SubmitSoftwareBundleInput submitNow(String bundleId, String action, List<SoftwarePackageInput> packages) {
        return SubmitSoftwareBundleInput.builder().id(bundleId).action(action).packages(packages).build();
    }
}
