package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.packagesearch.PackageManagerState;
import lombok.Data;

import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MachinePackageManagersMessage {

    public static final String STREAM = "MACHINE_PACKAGE_MANAGERS";
    public static final String SUBJECT_FILTER = "machine.*.package-managers";

    private Map<String, PackageManagerState> packageManagers;
}
