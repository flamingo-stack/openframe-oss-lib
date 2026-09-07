package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Data;

/**
 * Agent → server report: the given package manager is not installed on the
 * publishing machine.
 *
 * <pre>
 *   Subject: machine.{machineId}.package-manager-missing
 * </pre>
 *
 * The machineId is taken from the subject, never from the payload.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageManagerMissingMessage {

    public static final String STREAM = "PACKAGE_MANAGER_MISSING";
    public static final String SUBJECT_FILTER = "machine.*.package-manager-missing";

    private PackageManagerType packageManager;
}
