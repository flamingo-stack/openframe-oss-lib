package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageManagerMissingMessage {

    public static final String STREAM = "PACKAGE_MANAGER_MISSING";
    public static final String SUBJECT_FILTER = "machine.*.package-manager-missing";

    private PackageManagerType packageManager;
}
