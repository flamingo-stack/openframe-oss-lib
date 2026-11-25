package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class HostMdm {

    @JsonProperty("enrollment_status")
    private String enrollmentStatus;

    @JsonProperty("connected_to_fleet")
    private Boolean connectedToFleet;

    @JsonProperty("device_status")
    private HostDeviceStatus deviceStatus;

    @JsonProperty("pending_action")
    private HostPendingAction pendingAction;

    public String getEnrollmentStatus() { return enrollmentStatus; }
    public void setEnrollmentStatus(String enrollmentStatus) { this.enrollmentStatus = enrollmentStatus; }

    public Boolean getConnectedToFleet() { return connectedToFleet; }
    public void setConnectedToFleet(Boolean connectedToFleet) { this.connectedToFleet = connectedToFleet; }

    public HostDeviceStatus getDeviceStatus() { return deviceStatus; }
    public void setDeviceStatus(HostDeviceStatus deviceStatus) { this.deviceStatus = deviceStatus; }

    public HostPendingAction getPendingAction() { return pendingAction; }
    public void setPendingAction(HostPendingAction pendingAction) { this.pendingAction = pendingAction; }
}
