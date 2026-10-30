package com.openframe.data.service.machine;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.openframe.data.service.machine.MachineField.field;


public final class MachineFields {

    public static final MachineField<String> NICKNAME = field("nickname", Machine::setNickname);
    public static final MachineField<String> DISPLAY_NAME = field("displayName", Machine::setDisplayName);
    public static final MachineField<String> HOSTNAME = field("hostname", Machine::setHostname);
    public static final MachineField<DeviceStatus> STATUS = field("status", Machine::setStatus);
    public static final MachineField<DeviceType> TYPE = field("type", Machine::setType);
    public static final MachineField<Instant> LAST_SEEN = field("lastSeen", Machine::setLastSeen);
    public static final MachineField<String> ORGANIZATION_ID = field("organizationId", Machine::setOrganizationId);
    public static final MachineField<String> AGENT_VERSION = field("agentVersion", Machine::setAgentVersion);
    public static final MachineField<OsType> OS_TYPE = field("osType", Machine::setOsType);
    public static final MachineField<Instant> STUCK_NOTIFIED_AT = field("stuckNotifiedAt", Machine::setStuckNotifiedAt);
    public static final MachineField<Map<PackageManagerType, PackageManagerState>> PACKAGE_MANAGERS =
            field("packageManagers", Machine::setPackageManagers);

    // Hardware facts: copied from the registration request, then filled from the Fleet host where still blank
    public static final MachineField<String> SERIAL_NUMBER = field("serialNumber", Machine::setSerialNumber);
    public static final MachineField<String> MODEL = field("model", Machine::setModel);
    public static final MachineField<String> MANUFACTURER = field("manufacturer", Machine::setManufacturer);
    public static final MachineField<String> OS_UUID = field("osUuid", Machine::setOsUuid);
    public static final MachineField<String> COMPUTER_NAME = field("computerName", Machine::setComputerName);

    // Directory summary: written only by the SaaS directory matcher
    public static final MachineField<List<DirectorySource>> DIRECTORY_SOURCES =
            field("directorySources", Machine::setDirectorySources);
    public static final MachineField<DirectoryUserLink> DIRECTORY_USER_LINK =
            field("directoryUserLink", Machine::setDirectoryUserLink);
    public static final MachineField<List<String>> DIRECTORY_USER_IDS =
            field("directoryUserIds", Machine::setDirectoryUserIds);
    public static final MachineField<String> DIRECTORY_USER_NAME =
            field("directoryUserName", Machine::setDirectoryUserName);

    public static final MachineField<Instant> UPDATED_AT = field("updatedAt", Machine::setUpdatedAt);

    private MachineFields() {
    }
}
