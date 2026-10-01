package com.openframe.test.api.graphql;

// Software inventory and vulnerability reads on api/graphql: a thin proxy over Fleet MDM, present only where openframe.rmm.software.enabled is true.
public class SoftwareInventoryQueries {

    public static final String SOFTWARES = """
            query Softwares($filter: SoftwareFilterInput, $first: Int, $after: String, $search: String, $sort: SortInput) {
                softwares(filter: $filter, first: $first, after: $after, search: $search, sort: $sort) {
                    filteredCount
                    edges {
                        node {
                            id
                            name
                            publisher
                            source
                            currentVersion
                            latestVersion
                            versionStatus
                            olderVersionsCount
                            devicesCount
                            vulnerabilitySummary { highestSeverity cveCount }
                            cpeMatched
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String SOFTWARE = """
            query Software($id: ID!) {
                software(id: $id) {
                    id
                    name
                    publisher
                    source
                    currentVersion
                    latestVersion
                    versionStatus
                    olderVersionsCount
                    devicesCount
                    vulnerabilitySummary { highestSeverity cveCount }
                    cpeMatched
                }
            }
            """;

    public static final String SOFTWARE_FILTERS = """
            query SoftwareFilters($filter: SoftwareFilterInput, $search: String) {
                softwareFilters(filter: $filter, search: $search) {
                    sources { value label count }
                    versionStatuses { value label count }
                    severities { value label count }
                }
            }
            """;

    public static final String SOFTWARE_DEVICES = """
            query SoftwareDevices($softwareId: ID!, $filter: SoftwareOnDeviceFilterInput, $first: Int, $search: String) {
                softwareDevices(softwareId: $softwareId, filter: $filter, first: $first, search: $search) {
                    filteredCount
                    edges {
                        node {
                            device { id machineId hostname status organizationId }
                            softwareVersion
                            status
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String SOFTWARE_DEVICE_FILTERS = """
            query SoftwareDeviceFilters($softwareId: ID!, $search: String) {
                softwareDeviceFilters(softwareId: $softwareId, search: $search) {
                    statuses { value label count }
                }
            }
            """;

    public static final String SOFTWARE_VULNERABILITIES = """
            query SoftwareVulnerabilities($softwareId: ID!, $first: Int, $search: String, $sort: SortInput) {
                softwareVulnerabilities(softwareId: $softwareId, first: $first, search: $search, sort: $sort) {
                    filteredCount
                    edges {
                        node { cveId severity cvssScore affectedVersion discoveredAt }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String VULNERABILITIES = """
            query Vulnerabilities($filter: VulnerabilityFilterInput, $first: Int, $search: String, $sort: SortInput) {
                vulnerabilities(filter: $filter, first: $first, search: $search, sort: $sort) {
                    filteredCount
                    edges {
                        node {
                            cveId
                            severity
                            cvssScore
                            epssProbability
                            cisaKnownExploit
                            discoveredAt
                            detailsLink
                            devicesCount
                            description
                            resolvedInVersion
                            affectedSoftware { id name source version devicesCount customersCount resolvedInVersion }
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String VULNERABILITY = """
            query Vulnerability($cveId: String!) {
                vulnerability(cveId: $cveId) {
                    cveId
                    severity
                    cvssScore
                    epssProbability
                    cisaKnownExploit
                    discoveredAt
                    detailsLink
                    devicesCount
                    description
                    resolvedInVersion
                    affectedSoftware { id name source version devicesCount customersCount resolvedInVersion }
                }
            }
            """;

    public static final String VULNERABILITY_FILTERS = """
            query VulnerabilityFilters($filter: VulnerabilityFilterInput, $search: String) {
                vulnerabilityFilters(filter: $filter, search: $search) {
                    severities { value label count }
                }
            }
            """;

    public static final String VULNERABILITY_DEVICES = """
            query VulnerabilityDevices($cveId: String!, $first: Int, $search: String) {
                vulnerabilityDevices(cveId: $cveId, first: $first, search: $search) {
                    filteredCount
                    edges {
                        node { id machineId hostname status organizationId }
                        cursor
                    }
                }
            }
            """;

    public static final String DEVICE_SOFTWARE = """
            query DeviceSoftware($machineId: String!, $filter: SoftwareFilterInput, $first: Int, $search: String, $sort: SortInput) {
                deviceSoftware(machineId: $machineId, filter: $filter, first: $first, search: $search, sort: $sort) {
                    filteredCount
                    edges {
                        node {
                            id
                            name
                            publisher
                            source
                            currentVersion
                            latestVersion
                            versionStatus
                            olderVersionsCount
                            devicesCount
                            vulnerabilitySummary { highestSeverity cveCount }
                            cpeMatched
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String DEVICE_SOFTWARE_FILTERS = """
            query DeviceSoftwareFilters($machineId: String!, $search: String) {
                deviceSoftwareFilters(machineId: $machineId, search: $search) {
                    sources { value label count }
                    versionStatuses { value label count }
                    severities { value label count }
                }
            }
            """;

    public static final String DEVICE_VULNERABILITIES = """
            query DeviceVulnerabilities($machineId: String!, $filter: VulnerabilityFilterInput, $first: Int, $search: String, $sort: SortInput) {
                deviceVulnerabilities(machineId: $machineId, filter: $filter, first: $first, search: $search, sort: $sort) {
                    filteredCount
                    edges {
                        node {
                            cveId
                            severity
                            cvssScore
                            epssProbability
                            cisaKnownExploit
                            discoveredAt
                            detailsLink
                            devicesCount
                            description
                            resolvedInVersion
                            affectedSoftware { id name source version devicesCount customersCount resolvedInVersion }
                        }
                        cursor
                    }
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                }
            }
            """;

    public static final String DEVICE_VULNERABILITY_FILTERS = """
            query DeviceVulnerabilityFilters($machineId: String!, $search: String) {
                deviceVulnerabilityFilters(machineId: $machineId, search: $search) {
                    severities { value label count }
                }
            }
            """;
}
