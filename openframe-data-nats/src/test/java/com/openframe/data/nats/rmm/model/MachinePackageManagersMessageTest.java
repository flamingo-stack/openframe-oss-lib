package com.openframe.data.nats.rmm.model;

import com.openframe.data.document.packagesearch.PackageManagerState;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class MachinePackageManagersMessageTest {

    private static final String MANAGED_REPORT = """
            {
              "packageManagers": {"WINGET": "PRESENT", "CHOCO": "PRESENT"},
              "dependencies": [{"name": "dotnet", "state": "PRESENT"}],
              "chocolatey": {
                "version": "2.7.5",
                "edition": "OPEN_SOURCE",
                "ours": true,
                "status": "MANAGED",
                "reason": "VERSION_1",
                "packages": ["7zip", "GoogleChrome"],
                "existingPackages": ["git"]
              }
            }""";
    private static final String NEWER_AGENT_REPORT = """
            {
              "packageManagers": {"WINGET": "MISSING", "CHOCO": "PRESENT"},
              "dependencies": [{"name": "dotnet", "state": "PRESENT"}],
              "chocolatey": {
                "version": "3.0.0",
                "edition": "ENTERPRISE_PLUS",
                "ours": false,
                "status": "QUARANTINED",
                "reason": "POLICY_LOCKED",
                "packages": [],
                "existingPackages": ["7zip"]
              }
            }""";
    private static final String REPORT_WITH_EXTRA_FIELDS = """
            {
              "packageManagers": {"CHOCO": "PRESENT"},
              "reportedBy": {"agent": "2.0.0"},
              "chocolatey": {
                "version": "2.7.5",
                "status": "MANAGED",
                "ours": true,
                "packages": ["7zip"],
                "existingPackages": [],
                "installPath": "C:/ProgramData/chocolatey",
                "sources": [{"name": "openframe", "priority": 1}]
              }
            }""";
    private static final String BROKEN_CHOCO_REPORT = """
            {
              "packageManagers": {"CHOCO": "PRESENT"},
              "chocolatey": {"edition": "OPEN_SOURCE", "ours": false, "status": "ACTION_REQUIRED", "reason": "BROKEN"}
            }""";
    private static final String REPORT_WITHOUT_CHOCOLATEY = """
            {
              "packageManagers": {"WINGET": "PRESENT", "CHOCO": "MISSING"},
              "dependencies": [{"name": "dotnet", "state": "MISSING"}]
            }""";

    private final JsonMapper mapper = new JsonMapper();

    @Test
    void read_chocolateyObject_allFields() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(MANAGED_REPORT, MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getChocolatey())
                .extracting(MachinePackageManagersMessage.Chocolatey::getVersion,
                        MachinePackageManagersMessage.Chocolatey::getEdition,
                        MachinePackageManagersMessage.Chocolatey::isOurs,
                        MachinePackageManagersMessage.Chocolatey::getStatus,
                        MachinePackageManagersMessage.Chocolatey::getReason,
                        MachinePackageManagersMessage.Chocolatey::getPackages,
                        MachinePackageManagersMessage.Chocolatey::getExistingPackages)
                .containsExactly("2.7.5", "OPEN_SOURCE", true, "MANAGED", "VERSION_1",
                        List.of("7zip", "GoogleChrome"), List.of("git"));
    }

    @Test
    void read_unknownStatusReasonEdition_valuesKeptAsReported() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(NEWER_AGENT_REPORT, MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getChocolatey())
                .extracting(MachinePackageManagersMessage.Chocolatey::getStatus,
                        MachinePackageManagersMessage.Chocolatey::getReason,
                        MachinePackageManagersMessage.Chocolatey::getEdition,
                        MachinePackageManagersMessage.Chocolatey::getExistingPackages)
                .containsExactly("QUARANTINED", "POLICY_LOCKED", "ENTERPRISE_PLUS", List.of("7zip"));
    }

    @Test
    void read_unknownStatusReasonEdition_managerStatesKept() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(NEWER_AGENT_REPORT, MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getPackageManagers())
                .containsEntry("WINGET", PackageManagerState.MISSING)
                .containsEntry("CHOCO", PackageManagerState.PRESENT)
                .hasSize(2);
    }

    @Test
    void read_unknownStatusReasonEdition_dependenciesKept() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(NEWER_AGENT_REPORT, MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getDependencies())
                .extracting(MachinePackageManagersMessage.Dependency::getName,
                        MachinePackageManagersMessage.Dependency::getState)
                .containsExactly(tuple("dotnet", PackageManagerState.PRESENT));
    }

    @Test
    void read_unknownFieldsInTheReportAndInChocolatey_ignored() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(REPORT_WITH_EXTRA_FIELDS,
                MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getChocolatey())
                .extracting(MachinePackageManagersMessage.Chocolatey::getVersion,
                        MachinePackageManagersMessage.Chocolatey::getStatus,
                        MachinePackageManagersMessage.Chocolatey::isOurs,
                        MachinePackageManagersMessage.Chocolatey::getPackages)
                .containsExactly("2.7.5", "MANAGED", true, List.of("7zip"));
    }

    @Test
    void read_chocolateyWithoutVersionAndLists_nullVersionAndEmptyLists() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(BROKEN_CHOCO_REPORT, MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getChocolatey())
                .extracting(MachinePackageManagersMessage.Chocolatey::getVersion,
                        MachinePackageManagersMessage.Chocolatey::getStatus,
                        MachinePackageManagersMessage.Chocolatey::getReason,
                        MachinePackageManagersMessage.Chocolatey::isOurs,
                        MachinePackageManagersMessage.Chocolatey::getPackages,
                        MachinePackageManagersMessage.Chocolatey::getExistingPackages)
                .containsExactly(null, "ACTION_REQUIRED", "BROKEN", false, List.of(), List.of());
    }

    @Test
    void read_noChocolatey_null() {
        // execution
        MachinePackageManagersMessage report = mapper.readValue(REPORT_WITHOUT_CHOCOLATEY,
                MachinePackageManagersMessage.class);

        // verifications
        assertThat(report.getChocolatey()).isNull();
    }
}
