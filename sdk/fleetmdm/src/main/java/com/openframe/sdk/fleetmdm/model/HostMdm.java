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
    private String deviceStatus;

    @JsonProperty("pending_action")
    private String pendingAction;

    public String getEnrollmentStatus() { return enrollmentStatus; }
    public void setEnrollmentStatus(String enrollmentStatus) { this.enrollmentStatus = enrollmentStatus; }

    public Boolean getConnectedToFleet() { return connectedToFleet; }
    public void setConnectedToFleet(Boolean connectedToFleet) { this.connectedToFleet = connectedToFleet; }

    public String getDeviceStatus() { return deviceStatus; }
    public void setDeviceStatus(String deviceStatus) { this.deviceStatus = deviceStatus; }

    public String getPendingAction() { return pendingAction; }
    public void setPendingAction(String pendingAction) { this.pendingAction = pendingAction; }
}
