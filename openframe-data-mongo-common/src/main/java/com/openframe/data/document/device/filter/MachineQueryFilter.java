package com.openframe.data.document.device.filter;

import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collection;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachineQueryFilter {
    private List<String> statuses;
    private List<String> excludeStatuses;
    private List<String> deviceTypes;
    private List<OsType> osTypes;
    private List<String> organizationIds;
    private Collection<String> restrictToMachineIds;
    private Collection<PackageManagerType> manageableByPackageManagers;
    private String pattern;
    private List<String> hostnames;
    private List<String> nicknames;
    private List<String> tagKeys;
    private List<String> tagValues;
    // The directory summary an external directory integration writes; both empty in OSS. NONE also matches a machine never written.
    private List<DirectorySource> directorySources;
    private List<DirectoryUserLink> directoryUserLinks;

    public MachineQueryFilter(List<String> statuses, List<String> excludeStatuses, List<String> deviceTypes,
                              List<OsType> osTypes, List<String> organizationIds,
                              Collection<String> restrictToMachineIds,
                              Collection<PackageManagerType> manageableByPackageManagers) {
        this.statuses = statuses;
        this.excludeStatuses = excludeStatuses;
        this.deviceTypes = deviceTypes;
        this.osTypes = osTypes;
        this.organizationIds = organizationIds;
        this.restrictToMachineIds = restrictToMachineIds;
        this.manageableByPackageManagers = manageableByPackageManagers;
    }
}
