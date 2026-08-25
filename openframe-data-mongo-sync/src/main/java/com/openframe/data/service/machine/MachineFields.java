package com.openframe.data.service.machine;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;

import java.time.Instant;

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

    public static final MachineField<Instant> UPDATED_AT = field("updatedAt", Machine::setUpdatedAt);

    private MachineFields() {
    }
}
