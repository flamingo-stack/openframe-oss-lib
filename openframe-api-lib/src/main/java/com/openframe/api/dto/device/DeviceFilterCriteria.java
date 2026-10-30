package com.openframe.api.dto.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
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
public class DeviceFilterCriteria {

    private List<DeviceStatus> statuses;
    private List<DeviceType> deviceTypes;
    private List<OsType> osTypes;
    private List<String> organizationIds;

    private List<String> tagKeys;
    private List<String> tagValues;

    private Collection<PackageManagerType> manageableByPackageManagers;

    private String pattern;
    private List<String> hostnames;
    private List<String> nicknames;
    private List<DirectorySource> directorySources;
    private List<DirectoryUserLink> userLinks;

    public DeviceFilterCriteria(List<DeviceStatus> statuses, List<DeviceType> deviceTypes, List<OsType> osTypes,
                                List<String> organizationIds, List<String> tagKeys, List<String> tagValues,
                                Collection<PackageManagerType> manageableByPackageManagers) {
        this.statuses = statuses;
        this.deviceTypes = deviceTypes;
        this.osTypes = osTypes;
        this.organizationIds = organizationIds;
        this.tagKeys = tagKeys;
        this.tagValues = tagValues;
        this.manageableByPackageManagers = manageableByPackageManagers;
    }
}
