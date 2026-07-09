package com.openframe.test.api.graphql;

public class LogQueries {

    public static final String LOG_FILTERS = """
            query($filter: LogFilterInput) {
                logFilters(filter: $filter) {
                    toolTypes
                    eventTypes
                    severities
                    organizations {
                        id
                        name
                    }
                }
            }
            """;

    public static final String LOGS = """
            query($filter: LogFilterInput, $search: String, $sort: LogSortInput) {
                logs(filter: $filter, search: $search, sort: $sort) {
                    edges {
                        node {
                            toolEventId
                            eventType
                            ingestDay
                            toolType
                            severity
                            userId
                            deviceId
                            hostname
                            organizationId
                            organizationName
                            summary
                            timestamp
                        }
                        cursor
                    }
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }
                }
            }
            """;

    public static final String LOG_DETAILS = """
            query($ingestDay: String!, $toolType: String!, $eventType: String!, $timestamp: Instant!, $toolEventId: String!) {
                logDetails(
                    ingestDay: $ingestDay
                    toolType: $toolType
                    eventType: $eventType
                    timestamp: $timestamp
                    toolEventId: $toolEventId
                ) {
                    toolEventId
                    eventType
                    ingestDay
                    toolType
                    severity
                    userId
                    deviceId
                    hostname
                    organizationId
                    organizationName
                    message
                    timestamp
                    details
                }
            }
            """;
}
