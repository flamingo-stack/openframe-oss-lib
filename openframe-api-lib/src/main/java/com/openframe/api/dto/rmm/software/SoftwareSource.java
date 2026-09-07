package com.openframe.api.dto.rmm.software;

/**
 * Package-manager source of the software as reported by the OS inventory scan.
 * UNMANAGED covers everything installed outside a supported package manager
 * (custom MSI, driver bundles, side-loaded apps).
 */
public enum SoftwareSource {
    WINGET,
    CHOCOLATEY,
    BREW,
    UNMANAGED
}
