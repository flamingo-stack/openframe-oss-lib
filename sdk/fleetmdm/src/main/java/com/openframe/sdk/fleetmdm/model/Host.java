package com.openframe.sdk.fleetmdm.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Host model from Fleet MDM
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Host {
    private Long id;
    private String hostname;
    private String uuid;
    private String platform;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("updated_at")
    private String updatedAt;

    @JsonProperty("software_updated_at")
    private String softwareUpdatedAt;

    @JsonProperty("detail_updated_at")
    private String detailUpdatedAt;

    @JsonProperty("label_updated_at")
    private String labelUpdatedAt;

    @JsonProperty("policy_updated_at")
    private String policyUpdatedAt;

    @JsonProperty("last_enrolled_at")
    private String lastEnrolledAt;

    @JsonProperty("seen_time")
    private String seenTime;

    @JsonProperty("refetch_requested")
    private Boolean refetchRequested;

    @JsonProperty("osquery_version")
    private String osqueryVersion;

    @JsonProperty("orbit_version")
    private String orbitVersion;

    @JsonProperty("fleet_desktop_version")
    private String fleetDesktopVersion;

    @JsonProperty("scripts_enabled")
    private Boolean scriptsEnabled;

    @JsonProperty("os_version")
    private String osVersion;

    private String build;

    @JsonProperty("platform_like")
    private String platformLike;

    @JsonProperty("code_name")
    private String codeName;

    private Long uptime;
    private Long memory;

    @JsonProperty("cpu_type")
    private String cpuType;

    @JsonProperty("cpu_subtype")
    private String cpuSubtype;

    @JsonProperty("cpu_brand")
    private String cpuBrand;

    @JsonProperty("cpu_physical_cores")
    private Integer cpuPhysicalCores;

    @JsonProperty("cpu_logical_cores")
    private Integer cpuLogicalCores;

    @JsonProperty("hardware_vendor")
    private String hardwareVendor;

    @JsonProperty("hardware_model")
    private String hardwareModel;

    @JsonProperty("hardware_version")
    private String hardwareVersion;

    @JsonProperty("hardware_serial")
    private String hardwareSerial;

    @JsonProperty("computer_name")
    private String computerName;

    @JsonProperty("public_ip")
    private String publicIp;

    @JsonProperty("primary_ip")
    private String primaryIp;

    @JsonProperty("primary_mac")
    private String primaryMac;

    @JsonProperty("distributed_interval")
    private Integer distributedInterval;

    @JsonProperty("config_tls_refresh")
    private Integer configTlsRefresh;

    @JsonProperty("logger_tls_period")
    private Integer loggerTlsPeriod;

    @JsonProperty("team_id")
    private Long teamId;

    @JsonProperty("pack_stats")
    private Object packStats;

    @JsonProperty("team_name")
    private String teamName;

    @JsonProperty("gigs_disk_space_available")
    private Double gigsDiskSpaceAvailable;

    @JsonProperty("percent_disk_space_available")
    private Double percentDiskSpaceAvailable;

    @JsonProperty("gigs_total_disk_space")
    private Double gigsTotalDiskSpace;

    @JsonProperty("refetch_critical_queries_until")
    private String refetchCriticalQueriesUntil;

    @JsonProperty("last_restarted_at")
    private String lastRestartedAt;

    private String status;

    @JsonProperty("display_text")
    private String displayText;

    @JsonProperty("display_name")
    private String displayName;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getHostname() { return hostname; }
    public void setHostname(String hostname) { this.hostname = hostname; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getOsVersion() { return osVersion; }
    public void setOsVersion(String osVersion) { this.osVersion = osVersion; }

    public String getBuild() { return build; }
    public void setBuild(String build) { this.build = build; }

    public String getCpuBrand() { return cpuBrand; }
    public void setCpuBrand(String cpuBrand) { this.cpuBrand = cpuBrand; }

    public String getHardwareVendor() { return hardwareVendor; }
    public void setHardwareVendor(String hardwareVendor) { this.hardwareVendor = hardwareVendor; }

    public String getHardwareModel() { return hardwareModel; }
    public void setHardwareModel(String hardwareModel) { this.hardwareModel = hardwareModel; }

    public String getHardwareSerial() { return hardwareSerial; }
    public void setHardwareSerial(String hardwareSerial) { this.hardwareSerial = hardwareSerial; }

    public String getPrimaryIp() { return primaryIp; }
    public void setPrimaryIp(String primaryIp) { this.primaryIp = primaryIp; }

    public String getPrimaryMac() { return primaryMac; }
    public void setPrimaryMac(String primaryMac) { this.primaryMac = primaryMac; }

    public Long getTeamId() { return teamId; }
    public void setTeamId(Long teamId) { this.teamId = teamId; }

    public String getTeamName() { return teamName; }
    public void setTeamName(String teamName) { this.teamName = teamName; }

    public String getSeenTime() { return seenTime; }
    public void setSeenTime(String seenTime) { this.seenTime = seenTime; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public String getSoftwareUpdatedAt() { return softwareUpdatedAt; }
    public void setSoftwareUpdatedAt(String softwareUpdatedAt) { this.softwareUpdatedAt = softwareUpdatedAt; }

    public String getDetailUpdatedAt() { return detailUpdatedAt; }
    public void setDetailUpdatedAt(String detailUpdatedAt) { this.detailUpdatedAt = detailUpdatedAt; }

    public String getLabelUpdatedAt() { return labelUpdatedAt; }
    public void setLabelUpdatedAt(String labelUpdatedAt) { this.labelUpdatedAt = labelUpdatedAt; }

    public String getPolicyUpdatedAt() { return policyUpdatedAt; }
    public void setPolicyUpdatedAt(String policyUpdatedAt) { this.policyUpdatedAt = policyUpdatedAt; }

    public String getLastEnrolledAt() { return lastEnrolledAt; }
    public void setLastEnrolledAt(String lastEnrolledAt) { this.lastEnrolledAt = lastEnrolledAt; }

    public Boolean getRefetchRequested() { return refetchRequested; }
    public void setRefetchRequested(Boolean refetchRequested) { this.refetchRequested = refetchRequested; }

    public String getOsqueryVersion() { return osqueryVersion; }
    public void setOsqueryVersion(String osqueryVersion) { this.osqueryVersion = osqueryVersion; }

    public String getOrbitVersion() { return orbitVersion; }
    public void setOrbitVersion(String orbitVersion) { this.orbitVersion = orbitVersion; }

    public String getFleetDesktopVersion() { return fleetDesktopVersion; }
    public void setFleetDesktopVersion(String fleetDesktopVersion) { this.fleetDesktopVersion = fleetDesktopVersion; }

    public Boolean getScriptsEnabled() { return scriptsEnabled; }
    public void setScriptsEnabled(Boolean scriptsEnabled) { this.scriptsEnabled = scriptsEnabled; }

    public String getPlatformLike() { return platformLike; }
    public void setPlatformLike(String platformLike) { this.platformLike = platformLike; }

    public String getCodeName() { return codeName; }
    public void setCodeName(String codeName) { this.codeName = codeName; }

    public Long getUptime() { return uptime; }
    public void setUptime(Long uptime) { this.uptime = uptime; }

    public Long getMemory() { return memory; }
    public void setMemory(Long memory) { this.memory = memory; }

    public String getCpuType() { return cpuType; }
    public void setCpuType(String cpuType) { this.cpuType = cpuType; }

    public String getCpuSubtype() { return cpuSubtype; }
    public void setCpuSubtype(String cpuSubtype) { this.cpuSubtype = cpuSubtype; }

    public Integer getCpuPhysicalCores() { return cpuPhysicalCores; }
    public void setCpuPhysicalCores(Integer cpuPhysicalCores) { this.cpuPhysicalCores = cpuPhysicalCores; }

    public Integer getCpuLogicalCores() { return cpuLogicalCores; }
    public void setCpuLogicalCores(Integer cpuLogicalCores) { this.cpuLogicalCores = cpuLogicalCores; }

    public String getHardwareVersion() { return hardwareVersion; }
    public void setHardwareVersion(String hardwareVersion) { this.hardwareVersion = hardwareVersion; }

    public String getComputerName() { return computerName; }
    public void setComputerName(String computerName) { this.computerName = computerName; }

    public String getPublicIp() { return publicIp; }
    public void setPublicIp(String publicIp) { this.publicIp = publicIp; }

    public Integer getDistributedInterval() { return distributedInterval; }
    public void setDistributedInterval(Integer distributedInterval) { this.distributedInterval = distributedInterval; }

    public Integer getConfigTlsRefresh() { return configTlsRefresh; }
    public void setConfigTlsRefresh(Integer configTlsRefresh) { this.configTlsRefresh = configTlsRefresh; }

    public Integer getLoggerTlsPeriod() { return loggerTlsPeriod; }
    public void setLoggerTlsPeriod(Integer loggerTlsPeriod) { this.loggerTlsPeriod = loggerTlsPeriod; }

    public Object getPackStats() { return packStats; }
    public void setPackStats(Object packStats) { this.packStats = packStats; }

    public Double getGigsDiskSpaceAvailable() { return gigsDiskSpaceAvailable; }
    public void setGigsDiskSpaceAvailable(Double gigsDiskSpaceAvailable) { this.gigsDiskSpaceAvailable = gigsDiskSpaceAvailable; }

    public Double getPercentDiskSpaceAvailable() { return percentDiskSpaceAvailable; }
    public void setPercentDiskSpaceAvailable(Double percentDiskSpaceAvailable) { this.percentDiskSpaceAvailable = percentDiskSpaceAvailable; }

    public Double getGigsTotalDiskSpace() { return gigsTotalDiskSpace; }
    public void setGigsTotalDiskSpace(Double gigsTotalDiskSpace) { this.gigsTotalDiskSpace = gigsTotalDiskSpace; }

    public HostIssues getIssues() { return issues; }
    public void setIssues(HostIssues issues) { this.issues = issues; }

    public HostMdm getMdm() { return mdm; }
    public void setMdm(HostMdm mdm) { this.mdm = mdm; }

    public String getRefetchCriticalQueriesUntil() { return refetchCriticalQueriesUntil; }
    public void setRefetchCriticalQueriesUntil(String refetchCriticalQueriesUntil) { this.refetchCriticalQueriesUntil = refetchCriticalQueriesUntil; }

    public String getLastRestartedAt() { return lastRestartedAt; }
    public void setLastRestartedAt(String lastRestartedAt) { this.lastRestartedAt = lastRestartedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDisplayText() { return displayText; }
    public void setDisplayText(String displayText) { this.displayText = displayText; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
