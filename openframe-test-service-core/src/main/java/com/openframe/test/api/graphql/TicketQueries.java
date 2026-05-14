package com.openframe.test.api.graphql;

public class TicketQueries {

    public static final String TICKET_LABELS = """
            query TicketLabels {
                ticketLabels {
                    id
                    key
                    description
                    color
                    createdAt
                    createdBy
                }
            }
            """;

    public static final String GET_TICKETS = """
            query GetTickets($filter: TicketFilterInput, $pagination: CursorPaginationInput, $search: String) {
                tickets(filter: $filter, pagination: $pagination, search: $search, sort: { field: "order", direction: ASC }) {
                    edges {
                        cursor
                        node {
                            id
                            ticketNumber
                            title
                            status
                            owner {
                                ... on ClientTicketOwner {
                                    type
                                    machineId
                                    machine { id machineId hostname organizationId }
                                }
                                ... on AdminTicketOwner {
                                    type
                                    userId
                                    user { id firstName lastName }
                                }
                            }
                            deviceId
                            deviceHostname
                            organizationId
                            organizationName
                            assignedTo
                            assignedName
                            assigneeImage { imageUrl }
                            labels { id key color }
                            createdAt
                            updatedAt
                            resolvedAt
                            order
                        }
                    }
                    pageInfo {
                        hasNextPage
                        hasPreviousPage
                        startCursor
                        endCursor
                    }
                    filteredCount
                }
            }
            """;

    public static final String GET_TICKET = """
            query GetTicket($id: ID!) {
                ticket(id: $id) {
                    id
                    ticketNumber
                    title
                    description
                    status
                    creationSource
                    owner {
                        ... on ClientTicketOwner {
                            type
                            machineId
                            machine { id machineId hostname organizationId }
                        }
                        ... on AdminTicketOwner {
                            type
                            userId
                            user { id firstName lastName }
                        }
                    }
                    deviceId
                    deviceHostname
                    organizationId
                    organizationName
                    organizationImage { imageUrl }
                    assignedTo
                    assignedName
                    assigneeImage { imageUrl }
                    labels { id key color }
                    dialog {
                        id
                        currentMode
                        tokenUsage {
                            chatType
                            inputTokensSize
                            outputTokensSize
                            totalTokensSize
                            contextSize
                        }
                    }
                    attachments {
                        id
                        ticketId
                        fileName
                        contentType
                        fileSize
                        uploadedAt
                        uploadedBy
                    }
                    notes {
                        id
                        ticketId
                        content
                        authorId
                        author { id firstName lastName }
                        authorImage { imageUrl }
                        createdAt
                        updatedAt
                    }
                    createdAt
                    updatedAt
                    resolvedAt
                    order
                }
            }
            """;

    public static final String ARCHIVE_TICKET = """
            mutation ArchiveTicket($input: TicketIdInput!) {
                archiveTicket(input: $input) {
                    ticket { id status }
                    userErrors { field message }
                }
            }
            """;

    public static final String REORDER_TICKET = """
            mutation ReorderTicket($input: ReorderTicketInput!) {
                reorderTicket(input: $input) {
                    ticket { id status order }
                    userErrors { field message }
                }
            }
            """;

    public static final String RESOLVE_TICKET = """
            mutation ResolveTicket($input: TicketIdInput!) {
                resolveTicket(input: $input) {
                    ticket { id status resolvedAt }
                    userErrors { field message }
                }
            }
            """;

    public static final String PUT_TICKET_ON_HOLD = """
            mutation PutTicketOnHold($input: TicketIdInput!) {
                putTicketOnHold(input: $input) {
                    ticket { id status }
                    userErrors { field message }
                }
            }
            """;

    public static final String CREATE_TICKET = """
            mutation CreateTicket($input: CreateTicketInput!) {
                createTicket(input: $input) {
                    ticket {
                        id
                        ticketNumber
                        title
                        description
                        status
                        owner {
                            ... on ClientTicketOwner { type machineId }
                            ... on AdminTicketOwner { type userId }
                        }
                        deviceId
                        deviceHostname
                        organizationId
                        organizationName
                        assignedTo
                        assignedName
                        labels { id key color }
                        attachments {
                            id
                            ticketId
                            fileName
                            contentType
                            fileSize
                            uploadedAt
                            uploadedBy
                        }
                        createdAt
                        updatedAt
                    }
                    userErrors { field message }
                }
            }
            """;
}
