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
                            statusDefinition { id name kind }
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
                    statusDefinition { id name kind }
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

    public static final String REORDER_TICKET = """
            mutation ReorderTicket($input: ReorderTicketInput!) {
                reorderTicket(input: $input) {
                    ticket { id status statusDefinition { id name kind } order }
                    userErrors { field message }
                }
            }
            """;

    public static final String TICKET_STATUSES = """
            query TicketStatuses {
                ticketStatuses {
                    id
                    name
                    color
                    position
                    kind
                    isSystem
                    systemKey
                }
            }
            """;

    public static final String CREATE_TICKET_STATUS = """
            mutation CreateTicketStatus($input: CreateTicketStatusInput!) {
                createTicketStatus(input: $input) {
                    id
                    name
                    color
                    position
                    kind
                    isSystem
                    systemKey
                }
            }
            """;

    public static final String DELETE_TICKET_STATUS = """
            mutation DeleteTicketStatus($input: DeleteTicketStatusInput!) {
                deleteTicketStatus(input: $input)
            }
            """;

    public static final String TRANSITION_TICKET = """
            mutation TransitionTicket($input: TransitionTicketInput!) {
                transitionTicket(input: $input) {
                    ticket { id status statusDefinition { id name kind } resolvedAt }
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
