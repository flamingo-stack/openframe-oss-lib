package com.openframe.data.model.enums;

import lombok.Getter;

import java.util.List;

@Getter
public enum MessageType {

    MESHCENTRAL_EVENT(IntegratedToolType.MESHCENTRAL, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    COMMAND_EXECUTED(IntegratedToolType.RMM, DataEnrichmentServiceType.RMM_RESULTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT, Destination.CASSANDRA_COMMAND_RESULT, Destination.MONGO_COMMAND_HISTORY), EventHandlerType.COMMON_TYPE),
    SCRIPT_EXECUTED(IntegratedToolType.RMM, DataEnrichmentServiceType.RMM_RESULTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT, Destination.MONGO_HISTORY), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_QUERY_RESULT_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_POLICY_ACTIVITY_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_POLICY_MEMBERSHIP_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    MICROSOFT_365_AUDIT_EVENT(IntegratedToolType.MICROSOFT_365, DataEnrichmentServiceType.PRE_ENRICHED,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    GOOGLE_WORKSPACE_AUDIT_EVENT(IntegratedToolType.GOOGLE_WORKSPACE, DataEnrichmentServiceType.PRE_ENRICHED,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),
    REMOTE_SESSION_AUDIT_EVENT(IntegratedToolType.MESHCENTRAL, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT), EventHandlerType.COMMON_TYPE),

    // Fleet software-management CDC projections (tenant-level read-model). The two host-count
    // tables are team-scoped (team_id → tenant), so they enrich like every other Fleet event.
    // cve_meta is a global CVE dictionary with no tenant; it shares the same enrichment because
    // on a shared cluster that path resolves a null team to a null tenant (no provider fallback)
    // and skips the machine lookup when there is no agent — the global handler ignores tenant.
    FLEET_MDM_VULNERABILITY_HOST_COUNT_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_TENANT_CVE), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_SOFTWARE_TITLE_HOST_COUNT_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_TENANT_SOFTWARE), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_CVE_META_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_CVE_METADATA), EventHandlerType.COMMON_TYPE),
    // Global software-title catalog: fills the title name/source on tenant_software rows.
    FLEET_MDM_SOFTWARE_TITLE_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_SOFTWARE_TITLE_CATALOG), EventHandlerType.COMMON_TYPE),

    // Device-level software inventory (host_software). The global software catalog fills version
    // details; host_software itself carries no team, so its handler resolves tenant/machine from
    // the host id via tool_connections (Variant B) rather than the team_id enrichment path.
    FLEET_MDM_SOFTWARE_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_SOFTWARE_CATALOG), EventHandlerType.COMMON_TYPE),
    FLEET_MDM_HOST_SOFTWARE_EVENT(IntegratedToolType.FLEET, DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS,
            List.of(Destination.MONGO_DEVICE_SOFTWARE), EventHandlerType.COMMON_TYPE);

    private final IntegratedToolType integratedToolType;

    private final DataEnrichmentServiceType dataEnrichmentServiceType;

    private final List<Destination> destinationList;

    private final EventHandlerType eventHandlerType;

    MessageType(IntegratedToolType integratedToolType, DataEnrichmentServiceType dataEnrichmentServiceType, List<Destination> destinationList, EventHandlerType eventHandlerType) {
        this.integratedToolType = integratedToolType;
        this.dataEnrichmentServiceType = dataEnrichmentServiceType;
        this.destinationList = destinationList;
        this.eventHandlerType = eventHandlerType;
    }
}
