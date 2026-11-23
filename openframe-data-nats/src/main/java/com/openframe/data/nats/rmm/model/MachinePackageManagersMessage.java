package com.openframe.data.nats.rmm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.packagesearch.PackageManagerState;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class MachinePackageManagersMessage {

    public static final String STREAM = "MACHINE_PACKAGE_MANAGERS";
    public static final String SUBJECT_FILTER = "machine.*.package-managers";

    private Map<String, PackageManagerState> packageManagers;
    private List<Dependency> dependencies = List.of();
    private Chocolatey chocolatey;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Dependency {

        private String name;
        private PackageManagerState state;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Chocolatey {

        private String version;
        private String edition;
        private boolean ours;
        private String status;
        private String reason;
        private List<String> packages = List.of();
        private List<String> existingPackages = List.of();
    }
}
