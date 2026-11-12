package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;

import java.util.Collection;

public interface CustomPackageAutoUpdatePolicyRepository {

    // Upserts one enabled policy per machine from the template's tenant, package, settings and updatedBy.
    void enable(PackageAutoUpdatePolicy template, Collection<String> machineIds);

    // Sets the template's settings and updatedBy on the enabled policies of its tenant, Software and package on these
    // machines. lastVersion stays.
    void updateSettings(PackageAutoUpdatePolicy template, Collection<String> machineIds);

    // Turns off every enabled policy linked to the Software; returns how many it turned off.
    long disableBySoftwareId(String tenantId, String softwareId, String actor);

    // The same on the machines outside machineIds only.
    long disableBySoftwareIdAndMachineIdNotIn(String tenantId, String softwareId, Collection<String> machineIds,
                                              String actor);
}
