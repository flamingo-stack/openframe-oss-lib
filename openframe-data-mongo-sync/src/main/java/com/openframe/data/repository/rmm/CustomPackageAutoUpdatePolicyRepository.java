package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;

import java.util.Collection;
import java.util.List;

public interface CustomPackageAutoUpdatePolicyRepository {

    // Upserts one enabled policy per machine from the template's tenant, package, settings and updatedBy.
    void enable(PackageAutoUpdatePolicy template, Collection<String> machineIds);

    // Sets the template's settings and updatedBy on the enabled policies of its tenant, Software and package on these
    // machines. lastVersion stays.
    void updateSettings(PackageAutoUpdatePolicy template, Collection<String> machineIds);

    // Turns off every enabled policy linked to the Software; returns how many it turned off.
    long disableBySoftwareId(String tenantId, String softwareId, String actor);

    // The same, except the policies of the template's package on these machines: a machine keeps one policy per Software.
    long disableOthersOfSoftware(PackageAutoUpdatePolicy template, Collection<String> machineIds);

    // The distinct Software ids the tenant's policies are linked to.
    List<String> findSoftwareIds(String tenantId);

    // The same of the enabled policies only.
    List<String> findEnabledSoftwareIds(String tenantId);
}
